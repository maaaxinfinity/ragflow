"""
批量删除RAGFlow知识库中的所有文档

使用场景：
1. 清空知识库但保留知识库本身
2. 批量删除多个知识库的文档
3. 重置知识库内容

危险操作：会永久删除文档和文件，建议先备份！
"""

import os
import sys
import json
from pathlib import Path
from typing import List, Dict, Optional, Tuple

import requests
from tqdm import tqdm
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv

load_dotenv()

# 配置：从环境变量读取，或通过命令行参数传入
BASE_URL = os.environ.get("RAGFLOW_BASE_URL") or None
API_KEY = os.environ.get("RAGFLOW_API_KEY") or None
CONCURRENCY = int(os.environ.get("CONCURRENCY", "8"))
BATCH_SIZE = int(os.environ.get("DELETE_BATCH_SIZE", "50"))
KB_NAME_PREFIX = os.environ.get("KB_NAME_PREFIX", "")
KB_NAME_SUFFIX = os.environ.get("KB_NAME_SUFFIX", "")

HEADERS_JSON = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {API_KEY}" if API_KEY else "",
}

SESSION = requests.Session()


def ensure_config():
    global BASE_URL, API_KEY
    # 允许通过命令行传入 base_url api_key（可选）
    # 只有当第一个参数不是选项（不以--或-开头）时才从命令行读取
    if len(sys.argv) >= 3 and not sys.argv[1].startswith('-') and (not BASE_URL or not API_KEY):
        BASE_URL = BASE_URL or sys.argv[1]
        API_KEY = API_KEY or sys.argv[2]
    if not BASE_URL or not API_KEY:
        raise SystemExit("请通过环境变量 RAGFLOW_BASE_URL / RAGFLOW_API_KEY 或命令行参数提供 Base URL 与 API Key")
    if BASE_URL.endswith('/'):
        BASE_URL = BASE_URL[:-1]
    HEADERS_JSON["Authorization"] = f"Bearer {API_KEY}"


def list_all_datasets() -> List[Dict]:
    """分页列出当前可见的全部知识库。"""
    results: List[Dict] = []
    page, page_size = 1, 100
    while True:
        url = f"{BASE_URL}/api/v1/datasets"
        params = {"page": page, "page_size": page_size}
        resp = SESSION.get(url, headers=HEADERS_JSON, params=params, timeout=30)
        if resp.status_code != 200:
            print(f"[ERROR] 获取知识库列表失败: {resp.status_code} {resp.text}")
            break
        data = resp.json()
        # 兼容两种结构：{code:0,data:[...]} 或直接 [...]
        if isinstance(data, dict):
            if data.get("code") == 0:
                batch = data.get("data", [])
            else:
                batch = []
        else:
            batch = data or []
        if not batch:
            break
        results.extend(batch)
        if len(batch) < page_size:
            break
        page += 1
    return results


def list_documents_in_dataset(dataset_id: str, page_size: int = 1000) -> List[Dict]:
    """
    列出指定知识库的所有文档。
    返回文档列表，包含 id, name, chunk_count 等字段。
    """
    results: List[Dict] = []
    page = 1
    while True:
        url = f"{BASE_URL}/api/v1/datasets/{dataset_id}/documents"
        params = {"page": page, "page_size": page_size}
        try:
            resp = SESSION.get(url, headers=HEADERS_JSON, params=params, timeout=30)
            resp.raise_for_status()
        except Exception as e:
            print(f"[ERROR] 获取文档列表失败: {e}")
            break

        data = resp.json().get("data", {})
        docs = data.get("docs", [])
        results.extend(docs)
        # 检查是否还有下一页
        total = data.get("total", 0)
        if len(results) >= total:
            break
        page += 1
    return results


def delete_documents(dataset_id: str, doc_ids: List[str]) -> Tuple[bool, str]:
    """
    批量删除文档。
    API: DELETE /api/v1/datasets/{dataset_id}/documents
    Body: {"ids": ["doc_id1", "doc_id2", ...]}
    """
    if not doc_ids:
        return True, "无文档需要删除"

    url = f"{BASE_URL}/api/v1/datasets/{dataset_id}/documents"
    body = {"ids": doc_ids}

    try:
        resp = SESSION.request("DELETE", url, headers=HEADERS_JSON, json=body, timeout=120)
        if resp.status_code == 200:
            result = resp.json()
            if result.get("code") == 0:
                return True, f"成功删除 {len(doc_ids)} 个文档"
            else:
                return False, f"删除失败: {result.get('message', 'Unknown error')}"
        elif resp.status_code == 403:
            raise SystemExit(f"无权限访问知识库 {dataset_id}")
        else:
            return False, f"HTTP错误: {resp.status_code}, {resp.text}"
    except Exception as e:
        return False, f"请求异常: {e}"


def process_dataset_deletion(
    dataset_id: str,
    name: str,
    batch_size: int,
    dry_run: bool = False
) -> None:
    """处理单个知识库的文档删除。"""
    print(f"\n{'='*60}")
    print(f"知识库: {name}")
    print(f"ID: {dataset_id}")

    # 1. 获取所有文档
    docs = list_documents_in_dataset(dataset_id)
    if not docs:
        print("  状态: 无文档")
        return

    doc_ids = [d.get("id") for d in docs if d.get("id")]
    total = len(doc_ids)
    print(f"  文档总数: {total}")

    if dry_run:
        print(f"  [DRY-RUN] 将删除 {total} 个文档")
        return

    # 2. 分批删除
    effective_batch_size = min(batch_size, total) if batch_size > 0 else total
    batches: List[List[str]] = [doc_ids[i:i+effective_batch_size] for i in range(0, len(doc_ids), effective_batch_size)]

    print(f"  批次数: {len(batches)}（每批 {effective_batch_size} 个）")

    # 3. 并发删除（按批提交）
    with ThreadPoolExecutor(max_workers=max(1, int(CONCURRENCY))) as ex:
        futures = [ex.submit(delete_documents, dataset_id, b) for b in batches]
        with tqdm(total=len(batches), desc=f"删除 {name}", unit="批") as pbar:
            for fut in as_completed(futures):
                ok, info = fut.result()
                if not ok:
                    print(f"  [FAIL] {name}: {info}")
                pbar.update(1)

    print(f"  完成: 已处理 {total} 个文档")


def main():
    import argparse

    # 先处理配置（从环境变量或命令行前两个参数）
    ensure_config()

    parser = argparse.ArgumentParser(
        description="批量删除RAGFlow知识库中的文档",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  # 删除特定知识库的所有文档
  python delete_kb.py --names "测试库1,测试库2"

  # 删除所有包含"测试"关键词的知识库文档
  python delete_kb.py --only 测试

  # 删除所有知识库文档，但排除"生产"和"重要"
  python delete_kb.py --all --exclude 生产 --exclude 重要

  # 预览将要删除的知识库
  python delete_kb.py --only 测试 --dry-run

  # 从manifest文件读取
  python delete_kb.py --from-manifest kb_list.json
        """
    )

    parser.add_argument("--names", help="精确指定知识库名称（逗号分隔），如 '库1,库2'")
    parser.add_argument("--only", action="append", help="仅处理包含此关键词的知识库（可多次指定）")
    parser.add_argument("--exclude", action="append", help="排除包含此关键词的知识库（可多次指定）")
    parser.add_argument("--from-manifest", help="从JSON文件读取知识库列表")
    parser.add_argument("--all", action="store_true", help="处理所有知识库")
    parser.add_argument("--dry-run", action="store_true", help="预览模式，不实际删除")
    parser.add_argument("--batch", type=int, default=BATCH_SIZE, help=f"单批次删除文档数（默认 {BATCH_SIZE}）")

    args = parser.parse_args()

    # 确定目标知识库
    target_datasets: List[Dict] = []

    if args.from_manifest:
        manifest_path = Path(args.from_manifest)
        if not manifest_path.exists():
            raise SystemExit(f"Manifest文件不存在: {manifest_path}")
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
        dataset_names = [item.get("dataset_name") for item in manifest.get("datasets", [])]
        all_datasets = list_all_datasets()
        target_datasets = [ds for ds in all_datasets if ds.get("name") in dataset_names]
    else:
        all_datasets = list_all_datasets()

        # 应用前缀/后缀过滤
        filtered = []
        for ds in all_datasets:
            n = ds.get("name", "")
            if KB_NAME_PREFIX and not n.startswith(KB_NAME_PREFIX):
                continue
            if KB_NAME_SUFFIX and not n.endswith(KB_NAME_SUFFIX):
                continue
            filtered.append(ds)

        only_keywords = args.only if args.only else []
        exclude_keywords = args.exclude if args.exclude else []

        def match_only(n: str) -> bool:
            if not only_keywords:
                return True
            lower = n.lower()
            return any(k.lower() in lower for k in only_keywords)

        def match_exclude(n: str) -> bool:
            """返回True表示应该排除"""
            if not exclude_keywords:
                return False
            lower = n.lower()
            return any(k.lower() in lower for k in exclude_keywords)

        if args.names:
            exact_names = [x.strip() for x in args.names.split(",") if x.strip()]
            target_datasets = [ds for ds in filtered if ds.get("name") in exact_names]
        elif args.all:
            target_datasets = [ds for ds in filtered if match_only(ds.get("name", "")) and not match_exclude(ds.get("name", ""))]
        elif only_keywords:
            target_datasets = [ds for ds in filtered if match_only(ds.get("name", "")) and not match_exclude(ds.get("name", ""))]
        else:
            parser.print_help()
            return

    if not target_datasets:
        print("未找到匹配的知识库")
        return

    print(f"找到 {len(target_datasets)} 个知识库")
    for ds in target_datasets:
        print(f"  - {ds.get('name')} (ID: {ds.get('id')})")

    if args.dry_run:
        print("\n[DRY-RUN] 预览模式，不会实际删除")
    else:
        confirm = input(f"\n⚠️  即将删除 {len(target_datasets)} 个知识库中的所有文档，此操作不可恢复！\n确认删除？(yes/no): ")
        if confirm.lower() != 'yes':
            print("已取消操作")
            return

    # 执行删除
    for ds in target_datasets:
        process_dataset_deletion(
            dataset_id=ds.get("id"),
            name=ds.get("name"),
            batch_size=args.batch,
            dry_run=args.dry_run
        )

    print(f"\n{'='*60}")
    print(f"✅ 处理完成！共处理 {len(target_datasets)} 个知识库")


if __name__ == "__main__":
    main()

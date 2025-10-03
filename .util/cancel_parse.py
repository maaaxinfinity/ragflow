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
BATCH_SIZE = int(os.environ.get("CANCEL_BATCH_SIZE", "50"))
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
    if len(sys.argv) >= 3 and (not BASE_URL or not API_KEY):
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
        resp.raise_for_status()
        data = resp.json()
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


def get_dataset_by_name_exact(name: str) -> Optional[Dict]:
    """按名称精确匹配查找数据集。"""
    url = f"{BASE_URL}/api/v1/datasets"
    params = {"page": 1, "page_size": 1000, "name": name}
    try:
        resp = SESSION.get(url, headers=HEADERS_JSON, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        if isinstance(data, dict) and data.get("code") == 0:
            for ds in data.get("data", []):
                if str(ds.get("name", "")).lower() == name.lower():
                    return ds
    except Exception:
        pass
    # 回退到全量扫描
    for ds in list_all_datasets():
        if str(ds.get("name", "")).lower() == name.lower():
            return ds
    return None


def resolve_dataset_selection(
    only_keywords: List[str],
    explicit_names: List[str],
    manifest_path: Optional[Path],
    include_all: bool,
    exclude_keywords: List[str]
) -> List[str]:
    """确定待取消解析的数据集名称清单。

    策略优先级：
    1) 显式 --names 提供
    2) --from-manifest 或默认 ./kb_manifest.json 存在
    3) 提供 --only 关键词过滤 + （可选）前后缀过滤
    4) 使用 --exclude 反选（排除指定关键词）
    5) 若设置 include_all=True，则使用全部数据集（可叠加前后缀过滤和排除）
    否则报错提示。
    """
    if explicit_names:
        return [n.strip() for n in explicit_names if n.strip()]

    if manifest_path is None:
        p = Path("kb_manifest.json")
        manifest_path = p if p.exists() else None
    if manifest_path and manifest_path.exists():
        try:
            man = json.loads(manifest_path.read_text(encoding="utf-8"))
            names = [str(it.get("dataset_name")) for it in man.get("datasets", []) if it.get("dataset_name")]
            names = [n for n in names if n]
            if names:
                return names
        except Exception:
            pass

    # 从远端获取所有数据集
    all_ds = list_all_datasets()

    def match_prefix_suffix(n: str) -> bool:
        ok = True
        if KB_NAME_PREFIX:
            ok = ok and n.startswith(KB_NAME_PREFIX)
        if KB_NAME_SUFFIX:
            ok = ok and n.endswith(KB_NAME_SUFFIX)
        return ok

    def match_keywords(n: str) -> bool:
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

    # 应用前后缀、包含关键词和排除关键词过滤
    filtered = [
        ds.get("name", "") for ds in all_ds
        if match_prefix_suffix(str(ds.get("name", "")))
        and match_keywords(str(ds.get("name", "")))
        and not match_exclude(str(ds.get("name", "")))
    ]

    if filtered:
        return filtered

    if include_all:
        return [
            str(ds.get("name", "")) for ds in all_ds
            if match_prefix_suffix(str(ds.get("name", "")))
            and not match_exclude(str(ds.get("name", "")))
        ]

    raise SystemExit("未能确定取消解析目标。请使用 --names 或 --only，或提供 kb_manifest.json，或设置 --all 与前后缀/排除过滤。")


def list_documents(dataset_id: str, page_size: int = 200) -> List[Dict]:
    """分页列出指定数据集中的文档。"""
    docs: List[Dict] = []
    page = 1
    while True:
        url = f"{BASE_URL}/api/v1/datasets/{dataset_id}/documents"
        params = {
            "page": page,
            "page_size": page_size,
            "orderby": "create_time",
            "desc": True,
        }
        resp = SESSION.get(url, headers=HEADERS_JSON, params=params, timeout=60)
        if resp.status_code == 403:
            raise SystemExit(f"无权限访问数据集 {dataset_id}")
        resp.raise_for_status()
        data = resp.json()
        if isinstance(data, dict) and data.get("code") == 0:
            container = data.get("data", {}) or {}
            batch = container.get("docs", []) or []
            total = int(container.get("total", 0))
        else:
            batch = []
            total = 0
        if not batch:
            break
        docs.extend(batch)
        if len(docs) >= total:
            break
        page += 1
    return docs


def cancel_parse_documents(dataset_id: str, doc_ids: List[str]) -> Tuple[bool, str]:
    """调用取消解析接口（删除chunks）。"""
    if not doc_ids:
        return True, "无文档需要取消解析"

    # RAGFlow API: DELETE /api/v1/datasets/{dataset_id}/chunks
    # 需要提供 document_ids 参数
    url = f"{BASE_URL}/api/v1/datasets/{dataset_id}/chunks"
    payload = {"document_ids": doc_ids}

    resp = SESSION.delete(url, headers=HEADERS_JSON, data=json.dumps(payload), timeout=120)
    try:
        resp.raise_for_status()
    except Exception as e:
        return False, f"HTTP错误: {e}, 状态码={resp.status_code}, 响应={getattr(resp,'text','')[:300]}"

    try:
        data = resp.json()
    except Exception:
        data = None

    if isinstance(data, dict) and data.get("code") == 0:
        return True, f"已取消解析: {len(doc_ids)} 篇文档的chunks已删除"
    return False, f"取消解析返回异常: {data}"


def main():
    import argparse
    parser = argparse.ArgumentParser(description="批量取消解析（删除chunks）指定知识库的文档")
    parser.add_argument("base_url", nargs="?", help="可选，覆盖 .env 中的 RAGFLOW_BASE_URL")
    parser.add_argument("api_key", nargs="?", help="可选，覆盖 .env 中的 RAGFLOW_API_KEY")
    parser.add_argument("--only", dest="only", action="append", default=[], help="按子串过滤数据集名称（可多次传入）")
    parser.add_argument("--exclude", dest="exclude", action="append", default=[], help="排除包含指定子串的数据集（反选，可多次传入）")
    parser.add_argument("--names", dest="names", help="以逗号分隔的精确数据集名称列表")
    parser.add_argument("--from-manifest", dest="manifest", help="从指定的 kb_manifest.json 读取数据集名")
    parser.add_argument("--all", dest="include_all", action="store_true", help="在无其它筛选条件下，对所有可见数据集执行取消解析")
    parser.add_argument("--parsed-only", dest="parsed_only", action="store_true", help="仅取消已解析的文档（chunk_count > 0）")
    parser.add_argument("--dry-run", dest="dry_run", action="store_true", help="仅展示将要取消解析的数量，不真正发起请求")
    parser.add_argument("--batch", dest="batch", type=int, default=BATCH_SIZE, help=f"单次请求的最大文档数，默认 {BATCH_SIZE}")
    args = parser.parse_args()

    # 覆盖配置（若在命令行传入）
    global BASE_URL, API_KEY
    if args.base_url:
        BASE_URL = args.base_url
    if args.api_key:
        API_KEY = args.api_key
    effective_batch_size = args.batch or BATCH_SIZE

    ensure_config()

    explicit_names = []
    if args.names:
        explicit_names = [x.strip() for x in args.names.split(',') if x.strip()]

    manifest_path = Path(args.manifest) if args.manifest else None

    target_names = resolve_dataset_selection(
        only_keywords=args.only,
        explicit_names=explicit_names,
        manifest_path=manifest_path,
        include_all=args.include_all,
        exclude_keywords=args.exclude,
    )

    if not target_names:
        print("没有符合条件的数据集，已退出。")
        return

    print(f"将取消解析数据集 {len(target_names)} 个：")
    for n in target_names:
        print(f" - {n}")

    # 逐个数据集处理
    for name in target_names:
        ds = get_dataset_by_name_exact(name)
        if not ds:
            print(f"[WARN] 未找到数据集: {name}")
            continue
        ds_id = ds.get("id")
        if not ds_id:
            print(f"[WARN] 数据集无ID: {name} -> {ds}")
            continue

        docs = list_documents(ds_id)
        if not docs:
            print(f"[INFO] 数据集 {name} 暂无文档")
            continue

        if args.parsed_only:
            # 仅处理已解析的文档
            to_cancel = [d.get("id") for d in docs if d.get("id") and int(d.get("chunk_count", 0) or 0) > 0]
        else:
            # 处理所有文档
            to_cancel = [d.get("id") for d in docs if d.get("id")]

        print(f"[DATASET] {name} (id={ds_id})：共 {len(docs)} 篇，待取消解析 {len(to_cancel)} 篇（parsed_only={args.parsed_only}）")
        if not to_cancel:
            continue

        if args.dry_run:
            # 仅展示计划，不执行
            continue

        # 按批提交取消解析请求（支持并发）
        batches: List[List[str]] = [to_cancel[i:i+effective_batch_size] for i in range(0, len(to_cancel), effective_batch_size)]
        with ThreadPoolExecutor(max_workers=max(1, int(CONCURRENCY))) as ex:
            futures = [ex.submit(cancel_parse_documents, ds_id, b) for b in batches]
            with tqdm(total=len(batches), desc=f"取消解析 {name}", unit="批") as pbar:
                for fut in as_completed(futures):
                    ok, info = fut.result()
                    if ok:
                        pass
                    else:
                        print(f"[FAIL] {name}: {info}")
                    pbar.update(1)

    print("取消解析流程已完成（chunks已从服务端删除）")


if __name__ == "__main__":
    main()

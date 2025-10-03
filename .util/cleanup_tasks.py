"""
清理RAGFlow数据库中的遗留task记录

此脚本用于清理MySQL中已取消但未删除的task记录。
当文档的run状态为CANCEL(2)但task表中仍有记录时，这些是需要清理的遗留数据。

使用场景：
1. 旧版本RAGFlow取消解析后未清理task
2. 系统异常导致的task记录残留
3. 定期维护清理无效task

危险操作：请谨慎使用，建议先备份数据库！
"""

import os
import sys
from typing import List, Dict, Optional
from dotenv import load_dotenv

load_dotenv()

# MySQL配置
MYSQL_HOST = os.environ.get("MYSQL_HOST", "localhost")
MYSQL_PORT = int(os.environ.get("MYSQL_PORT", "3306"))
MYSQL_USER = os.environ.get("MYSQL_USER", "root")
MYSQL_PASSWORD = os.environ.get("MYSQL_PASSWORD", "infini_rag_flow")
MYSQL_DATABASE = os.environ.get("MYSQL_DATABASE", "rag_flow")
DOCKER_CONTAINER = os.environ.get("DOCKER_CONTAINER", "ragflow-mysql")

# Redis配置
REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")
REDIS_PORT = int(os.environ.get("REDIS_PORT", "6379"))
REDIS_DB = int(os.environ.get("REDIS_DB", "1"))
REDIS_PASSWORD = os.environ.get("REDIS_PASSWORD", "infini_rag_flow")


def execute_mysql_query(query: str, use_docker: bool = True) -> List[Dict]:
    """执行MySQL查询"""
    import subprocess
    import json

    if use_docker:
        # 通过Docker容器执行
        cmd = [
            "sudo", "docker", "exec", DOCKER_CONTAINER,
            "mysql", f"-u{MYSQL_USER}", f"-p{MYSQL_PASSWORD}",
            "-e", query,
            "--batch", "--skip-column-names"
        ]
    else:
        # 直接连接MySQL
        cmd = [
            "mysql",
            f"-h{MYSQL_HOST}",
            f"-P{MYSQL_PORT}",
            f"-u{MYSQL_USER}",
            f"-p{MYSQL_PASSWORD}",
            "-e", query,
            "--batch", "--skip-column-names"
        ]

    try:
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
        lines = result.stdout.strip().split('\n')
        if not lines or not lines[0]:
            return []

        # 简单解析TSV格式输出
        results = []
        for line in lines:
            if line:
                parts = line.split('\t')
                results.append(parts)
        return results
    except subprocess.CalledProcessError as e:
        print(f"MySQL查询失败: {e}")
        return []


def get_orphaned_tasks(use_docker: bool = True) -> List[tuple]:
    """获取孤立的task记录（文档已取消/删除但task仍存在）"""
    query = f"""
    USE {MYSQL_DATABASE};
    SELECT t.id, t.doc_id, d.run, d.progress, d.name
    FROM task t
    LEFT JOIN document d ON t.doc_id = d.id
    WHERE d.id IS NULL OR d.run = '2';
    """

    results = execute_mysql_query(query, use_docker)
    orphaned = []
    for row in results:
        if len(row) >= 2:
            orphaned.append(tuple(row))
    return orphaned


def get_task_count_by_dataset(dataset_id: str = None, use_docker: bool = True) -> List[tuple]:
    """统计各知识库的task数量"""
    if dataset_id:
        where_clause = f"AND d.kb_id = '{dataset_id}'"
    else:
        where_clause = ""

    query = f"""
    USE {MYSQL_DATABASE};
    SELECT d.kb_id, k.name, COUNT(t.id) as task_count
    FROM task t
    JOIN document d ON t.doc_id = d.id
    LEFT JOIN knowledgebase k ON d.kb_id = k.id
    WHERE 1=1 {where_clause}
    GROUP BY d.kb_id, k.name
    ORDER BY task_count DESC;
    """

    results = execute_mysql_query(query, use_docker)
    return [tuple(row) for row in results]


def delete_tasks_by_ids(task_ids: List[str], use_docker: bool = True, dry_run: bool = False) -> int:
    """删除指定的task记录"""
    if not task_ids:
        return 0

    if dry_run:
        print(f"[DRY-RUN] 将删除 {len(task_ids)} 条task记录")
        return 0

    # 分批删除，避免SQL语句过长
    batch_size = 500
    deleted = 0

    for i in range(0, len(task_ids), batch_size):
        batch = task_ids[i:i+batch_size]
        ids_str = "','".join(batch)
        query = f"""
        USE {MYSQL_DATABASE};
        DELETE FROM task WHERE id IN ('{ids_str}');
        """

        execute_mysql_query(query, use_docker)
        deleted += len(batch)
        print(f"已删除 {deleted}/{len(task_ids)} 条task记录")

    return deleted


def delete_tasks_by_doc_ids(doc_ids: List[str], use_docker: bool = True, dry_run: bool = False) -> int:
    """删除指定文档的所有task记录"""
    if not doc_ids:
        return 0

    if dry_run:
        print(f"[DRY-RUN] 将删除 {len(doc_ids)} 个文档的task记录")
        return 0

    batch_size = 500
    deleted = 0

    for i in range(0, len(doc_ids), batch_size):
        batch = doc_ids[i:i+batch_size]
        ids_str = "','".join(batch)
        query = f"""
        USE {MYSQL_DATABASE};
        DELETE FROM task WHERE doc_id IN ('{ids_str}');
        """

        execute_mysql_query(query, use_docker)
        deleted += len(batch)
        print(f"已删除 {deleted}/{len(doc_ids)} 个文档的task记录")

    return deleted


def get_redis_connection():
    """获取Redis连接"""
    try:
        import redis
        r = redis.Redis(
            host=REDIS_HOST,
            port=REDIS_PORT,
            db=REDIS_DB,
            password=REDIS_PASSWORD,
            decode_responses=True
        )
        r.ping()
        return r
    except Exception as e:
        print(f"Redis连接失败: {e}")
        return None


def clean_redis_cancel_markers(task_ids: List[str], dry_run: bool = False) -> int:
    """清理Redis中的task cancel标记"""
    if not task_ids:
        return 0

    r = get_redis_connection()
    if not r:
        print("跳过Redis清理（连接失败）")
        return 0

    if dry_run:
        print(f"[DRY-RUN] 将清理 {len(task_ids)} 个Redis cancel标记")
        return 0

    cleaned = 0
    for task_id in task_ids:
        try:
            key = f"{task_id}-cancel"
            if r.delete(key):
                cleaned += 1
        except Exception as e:
            print(f"清理Redis标记失败 {task_id}: {e}")

    print(f"清理了 {cleaned} 个Redis cancel标记")
    return cleaned


def clean_redis_stream_queue(dry_run: bool = False) -> int:
    """清理Redis Stream队列中的消息"""
    r = get_redis_connection()
    if not r:
        print("跳过Redis Stream清理（连接失败）")
        return 0

    stream_key = "rag_flow_svr_queue"

    try:
        # 获取stream长度
        stream_len = r.xlen(stream_key)

        if stream_len == 0:
            print("Redis Stream队列为空，无需清理")
            return 0

        # 获取消费者组信息
        try:
            groups = r.xinfo_groups(stream_key)
            if groups:
                group_info = groups[0]
                lag = group_info.get('lag', 0)
                print(f"发现 Redis Stream: {stream_key}")
                print(f"  总消息数: {stream_len}")
                print(f"  Lag: {lag}")
                print(f"  消费者组: {group_info.get('name')}")
        except Exception:
            print(f"发现 Redis Stream: {stream_key}, 消息数: {stream_len}")

        if dry_run:
            print(f"[DRY-RUN] 将删除 {stream_len} 条Stream消息")
            return 0

        # 删除stream
        result = r.delete(stream_key)
        if result:
            print(f"成功删除 Redis Stream: {stream_key} ({stream_len} 条消息)")
            return stream_len
        else:
            print("删除 Redis Stream 失败")
            return 0

    except Exception as e:
        print(f"清理 Redis Stream 失败: {e}")
        return 0


def main():
    import argparse

    parser = argparse.ArgumentParser(description="清理RAGFlow遗留的task记录")
    parser.add_argument("--list-orphaned", action="store_true", help="列出所有孤立的task记录")
    parser.add_argument("--list-by-dataset", action="store_true", help="按知识库统计task数量")
    parser.add_argument("--dataset-id", help="指定知识库ID")
    parser.add_argument("--clean-orphaned", action="store_true", help="清理所有孤立的task记录")
    parser.add_argument("--clean-canceled", action="store_true", help="清理已取消文档的task记录")
    parser.add_argument("--clean-dataset", help="清理指定知识库的所有task记录（需提供dataset_id）")
    parser.add_argument("--clean-stream", action="store_true", help="清理Redis Stream任务队列")
    parser.add_argument("--dry-run", action="store_true", help="预览模式，不实际删除")
    parser.add_argument("--no-docker", action="store_true", help="不使用Docker，直接连接MySQL")

    args = parser.parse_args()

    use_docker = not args.no_docker

    if args.list_orphaned:
        print("正在查询孤立的task记录...")
        orphaned = get_orphaned_tasks(use_docker)
        if orphaned:
            print(f"\n找到 {len(orphaned)} 条孤立的task记录：")
            print("\nTask ID                          | Doc ID                           | Run | Progress | Doc Name")
            print("-" * 120)
            for row in orphaned:
                task_id = row[0] if len(row) > 0 else "N/A"
                doc_id = row[1] if len(row) > 1 else "N/A"
                run = row[2] if len(row) > 2 else "NULL"
                progress = row[3] if len(row) > 3 else "NULL"
                name = row[4] if len(row) > 4 else "NULL"
                print(f"{task_id:<32} | {doc_id:<32} | {run:<3} | {progress:<8} | {name}")
        else:
            print("未发现孤立的task记录")

    elif args.list_by_dataset:
        print("正在统计各知识库的task数量...")
        stats = get_task_count_by_dataset(args.dataset_id, use_docker)
        if stats:
            print(f"\n知识库task统计：")
            print("\nDataset ID                        | 知识库名称                | Task数量")
            print("-" * 80)
            for row in stats:
                kb_id = row[0] if len(row) > 0 else "N/A"
                kb_name = row[1] if len(row) > 1 else "N/A"
                count = row[2] if len(row) > 2 else "0"
                print(f"{kb_id:<32} | {kb_name:<24} | {count}")
        else:
            print("未找到task记录")

    elif args.clean_orphaned:
        print("正在清理孤立的task记录...")
        orphaned = get_orphaned_tasks(use_docker)
        if orphaned:
            task_ids = [row[0] for row in orphaned if len(row) > 0]
            print(f"找到 {len(task_ids)} 条孤立的task记录")

            if args.dry_run:
                print("[DRY-RUN] 将删除以下task记录：")
                for tid in task_ids[:10]:  # 只显示前10条
                    print(f"  - {tid}")
                if len(task_ids) > 10:
                    print(f"  ... 还有 {len(task_ids) - 10} 条")
                clean_redis_cancel_markers(task_ids, dry_run=True)
                clean_redis_stream_queue(dry_run=True)
            else:
                confirm = input(f"确认删除这 {len(task_ids)} 条task记录？(yes/no): ")
                if confirm.lower() == 'yes':
                    # 先清理Redis cancel标记
                    clean_redis_cancel_markers(task_ids, dry_run=False)
                    # 清理Redis Stream队列
                    clean_redis_stream_queue(dry_run=False)
                    # 最后删除MySQL记录
                    deleted = delete_tasks_by_ids(task_ids, use_docker, args.dry_run)
                    print(f"成功删除 {deleted} 条task记录")
                else:
                    print("已取消操作")
        else:
            print("未发现需要清理的孤立task记录")

    elif args.clean_canceled:
        print("正在清理已取消文档的task记录...")
        # 先获取task IDs用于Redis清理
        query_tasks = f"""
        USE {MYSQL_DATABASE};
        SELECT t.id
        FROM task t
        JOIN document d ON t.doc_id = d.id
        WHERE d.run = '2';
        """
        task_results = execute_mysql_query(query_tasks, use_docker)
        task_ids = [row[0] for row in task_results if len(row) > 0]

        # 获取doc IDs用于删除
        query_docs = f"""
        USE {MYSQL_DATABASE};
        SELECT DISTINCT t.doc_id
        FROM task t
        JOIN document d ON t.doc_id = d.id
        WHERE d.run = '2';
        """
        doc_results = execute_mysql_query(query_docs, use_docker)
        doc_ids = [row[0] for row in doc_results if len(row) > 0]

        if doc_ids:
            print(f"找到 {len(doc_ids)} 个已取消文档的task记录")

            if args.dry_run:
                print(f"[DRY-RUN] 将删除这些文档的task记录")
                clean_redis_cancel_markers(task_ids, dry_run=True)
                clean_redis_stream_queue(dry_run=True)
            else:
                confirm = input(f"确认删除？(yes/no): ")
                if confirm.lower() == 'yes':
                    # 先清理Redis cancel标记
                    clean_redis_cancel_markers(task_ids, dry_run=False)
                    # 清理Redis Stream队列
                    clean_redis_stream_queue(dry_run=False)
                    # 最后删除MySQL记录
                    deleted = delete_tasks_by_doc_ids(doc_ids, use_docker, args.dry_run)
                    print(f"成功删除 {deleted} 条task记录")
                else:
                    print("已取消操作")
        else:
            print("未发现已取消文档的task记录")

    elif args.clean_dataset:
        dataset_id = args.clean_dataset
        print(f"正在清理知识库 {dataset_id} 的task记录...")

        # 先获取task IDs用于Redis清理
        query_tasks = f"""
        USE {MYSQL_DATABASE};
        SELECT t.id
        FROM task t
        JOIN document d ON t.doc_id = d.id
        WHERE d.kb_id = '{dataset_id}';
        """
        task_results = execute_mysql_query(query_tasks, use_docker)
        task_ids = [row[0] for row in task_results if len(row) > 0]

        # 获取doc IDs用于删除
        query_docs = f"""
        USE {MYSQL_DATABASE};
        SELECT t.doc_id
        FROM task t
        JOIN document d ON t.doc_id = d.id
        WHERE d.kb_id = '{dataset_id}';
        """
        doc_results = execute_mysql_query(query_docs, use_docker)
        doc_ids = [row[0] for row in doc_results if len(row) > 0]

        if doc_ids:
            print(f"找到 {len(doc_ids)} 个文档的task记录")

            if args.dry_run:
                print(f"[DRY-RUN] 将删除这些task记录")
                clean_redis_cancel_markers(task_ids, dry_run=True)
                clean_redis_stream_queue(dry_run=True)
            else:
                confirm = input(f"确认删除知识库 {dataset_id} 的所有task记录？(yes/no): ")
                if confirm.lower() == 'yes':
                    # 先清理Redis cancel标记
                    clean_redis_cancel_markers(task_ids, dry_run=False)
                    # 清理Redis Stream队列
                    clean_redis_stream_queue(dry_run=False)
                    # 最后删除MySQL记录
                    deleted = delete_tasks_by_doc_ids(doc_ids, use_docker, args.dry_run)
                    print(f"成功删除 {deleted} 条task记录")
                else:
                    print("已取消操作")
        else:
            print(f"知识库 {dataset_id} 没有task记录")

    elif args.clean_stream:
        print("正在清理Redis Stream任务队列...")
        if args.dry_run:
            clean_redis_stream_queue(dry_run=True)
        else:
            clean_redis_stream_queue(dry_run=False)

    else:
        parser.print_help()
        print("\n常用示例：")
        print("  # 列出所有孤立的task")
        print("  python cleanup_tasks.py --list-orphaned")
        print("")
        print("  # 统计各知识库的task数量")
        print("  python cleanup_tasks.py --list-by-dataset")
        print("")
        print("  # 清理孤立的task（预览）")
        print("  python cleanup_tasks.py --clean-orphaned --dry-run")
        print("")
        print("  # 清理孤立的task（实际执行）")
        print("  python cleanup_tasks.py --clean-orphaned")
        print("")
        print("  # 清理已取消文档的task")
        print("  python cleanup_tasks.py --clean-canceled")
        print("")
        print("  # 清理Redis Stream任务队列")
        print("  python cleanup_tasks.py --clean-stream")


if __name__ == "__main__":
    main()

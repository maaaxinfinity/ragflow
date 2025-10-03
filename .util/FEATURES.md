# 功能特性对比

## resolve.py vs cancel_parse.py

| 功能特性 | resolve.py<br>(解析) | cancel_parse.py<br>(取消解析) | 说明 |
|---------|---------------------|----------------------------|------|
| **核心功能** | ✅ 触发文档解析（切片） | ✅ 删除文档chunks | 互补功能 |
| **tqdm进度条** | ✅ 显示批次进度 | ✅ 显示批次进度 | 实时显示处理进度 |
| **并行处理** | ✅ ThreadPoolExecutor | ✅ ThreadPoolExecutor | 提高处理速度 |
| **批次处理** | ✅ 可配置batch大小 | ✅ 可配置batch大小 | 控制单次请求量 |
| **并发控制** | ✅ CONCURRENCY环境变量 | ✅ CONCURRENCY环境变量 | 避免服务器压力 |
| **指定名称** | ✅ --names | ✅ --names | 精确指定知识库 |
| **关键词过滤** | ✅ --only (多次) | ✅ --only (多次) | 包含关键词 |
| **反选排除** | ❌ 不支持 | ✅ --exclude (多次) | **新增**排除关键词 |
| **manifest文件** | ✅ --from-manifest | ✅ --from-manifest | 从JSON读取 |
| **全选模式** | ✅ --all | ✅ --all | 处理所有知识库 |
| **前缀过滤** | ✅ KB_NAME_PREFIX | ✅ KB_NAME_PREFIX | 环境变量配置 |
| **后缀过滤** | ✅ KB_NAME_SUFFIX | ✅ KB_NAME_SUFFIX | 环境变量配置 |
| **预览模式** | ✅ --dry-run | ✅ --dry-run | 不实际执行 |
| **强制模式** | ✅ --force | - | 重新解析所有文档 |
| **条件过滤** | chunk_count == 0 | ✅ --parsed-only | 仅处理已解析 |

## 实现细节

### 进度显示 (tqdm)

**resolve.py 第 279-286 行：**
```python
with ThreadPoolExecutor(max_workers=max(1, int(CONCURRENCY))) as ex:
    futures = [ex.submit(parse_documents, ds_id, b) for b in batches]
    with tqdm(total=len(batches), desc=f"解析 {name}", unit="批") as pbar:
        for fut in as_completed(futures):
            ok, info = fut.result()
            if ok:
                pass
            else:
                print(f"[FAIL] {name}: {info}")
            pbar.update(1)
```

**cancel_parse.py 第 307-316 行：**
```python
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
```

### 批次分割

**resolve.py 第 276 行：**
```python
batches: List[List[str]] = [to_parse[i:i+effective_batch_size] for i in range(0, len(to_parse), effective_batch_size)]
```

**cancel_parse.py 第 306 行：**
```python
batches: List[List[str]] = [to_cancel[i:i+effective_batch_size] for i in range(0, len(to_cancel), effective_batch_size)]
```

### 并发控制

**两者都使用相同的配置：**
```python
CONCURRENCY = int(os.environ.get("CONCURRENCY", "8"))
BATCH_SIZE = int(os.environ.get("PARSE_BATCH_SIZE", "50"))  # resolve.py
BATCH_SIZE = int(os.environ.get("CANCEL_BATCH_SIZE", "50")) # cancel_parse.py
```

## 新增功能详解

### 1. 反选功能 (--exclude)

**仅在 cancel_parse.py 中可用**

```python
def match_exclude(n: str) -> bool:
    """返回True表示应该排除"""
    if not exclude_keywords:
        return False
    lower = n.lower()
    return any(k.lower() in lower for k in exclude_keywords)
```

**使用场景：**
- 安全操作：排除生产环境知识库
- 批量处理：处理除了重要库外的所有库

**示例：**
```bash
# 取消所有测试库，但保留生产库
python cancel_parse.py --all --exclude 生产 --exclude 重要

# 处理所有库，排除多个关键词
python cancel_parse.py --all --exclude 正式 --exclude prod --exclude master
```

### 2. 条件过滤 (--parsed-only)

**仅在 cancel_parse.py 中可用**

```python
if args.parsed_only:
    # 仅处理已解析的文档
    to_cancel = [d.get("id") for d in docs if d.get("id") and int(d.get("chunk_count", 0) or 0) > 0]
else:
    # 处理所有文档
    to_cancel = [d.get("id") for d in docs if d.get("id")]
```

**使用场景：**
- 清理已解析文档，保留未解析的
- 批量重置时精确控制

**示例：**
```bash
# 仅清理已解析的文档
python cancel_parse.py --names "法律法规测试" --parsed-only

# 清理所有已解析的测试库
python cancel_parse.py --only 测试 --parsed-only
```

## 性能对比

### 串行 vs 并行处理

假设：
- 100个文档
- 每个API调用耗时 1秒
- BATCH_SIZE = 50
- CONCURRENCY = 8

**串行处理：**
- 批次数：100 / 50 = 2批
- 总耗时：2秒

**并行处理（当前实现）：**
- 批次数：2批
- 并发提交：2批同时处理
- 总耗时：~1秒（受限于网络和服务器）

### 批次大小影响

| BATCH_SIZE | 100文档批次数 | API调用次数 | 适用场景 |
|-----------|------------|----------|---------|
| 10 | 10 | 10 | 慢速安全，服务器压力小 |
| 50 | 2 | 2 | 默认平衡 |
| 100 | 1 | 1 | 快速处理，需要服务器性能好 |
| 200 | 1 | 1 | 极速模式，可能超时 |

### 并发数影响

| CONCURRENCY | 10批次耗时估算 | 适用场景 |
|------------|------------|---------|
| 1 | 10秒 | 单线程，最安全 |
| 4 | 2.5秒 | 低并发 |
| 8 | 1.25秒 | 默认推荐 |
| 16 | 0.625秒 | 高并发，需要服务器支持 |

## 使用建议

### 首次使用

1. **小范围测试**
   ```bash
   python resolve.py --names "测试库1" --dry-run
   python resolve.py --names "测试库1"
   ```

2. **逐步扩大**
   ```bash
   python resolve.py --only 测试 --batch 20
   ```

3. **生产环境**
   ```bash
   # 先排除重要库测试
   python resolve.py --all --exclude 生产 --dry-run
   python resolve.py --all --exclude 生产
   ```

### 性能调优

1. **网络良好时**
   ```env
   CONCURRENCY=16
   PARSE_BATCH_SIZE=100
   ```

2. **网络不稳定时**
   ```env
   CONCURRENCY=4
   PARSE_BATCH_SIZE=20
   ```

3. **服务器压力大时**
   ```env
   CONCURRENCY=2
   PARSE_BATCH_SIZE=10
   ```

## 错误处理

两个工具都实现了完善的错误处理：

1. **HTTP错误捕获**
   ```python
   try:
       resp.raise_for_status()
   except Exception as e:
       return False, f"HTTP错误: {e}, 状态码={resp.status_code}"
   ```

2. **批次失败不中断**
   ```python
   for fut in as_completed(futures):
       ok, info = fut.result()
       if ok:
           pass
       else:
           print(f"[FAIL] {name}: {info}")  # 记录但继续
       pbar.update(1)
   ```

3. **权限验证**
   ```python
   if resp.status_code == 403:
       raise SystemExit(f"无权限访问数据集 {dataset_id}")
   ```

## 总结

✅ **cancel_parse.py 已完全实现：**
- tqdm 进度显示
- ThreadPoolExecutor 并行处理
- 可配置的批次大小
- 并发数控制
- 与 resolve.py 完全对等的实现

✅ **新增独特功能：**
- --exclude 反选排除
- --parsed-only 条件过滤

✅ **生产就绪：**
- 完善的错误处理
- 详细的日志输出
- 安全的预览模式

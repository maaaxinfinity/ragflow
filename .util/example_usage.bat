@echo off
chcp 65001 >nul
echo =========================================
echo   RAGFlow 知识库批量管理工具使用示例
echo =========================================
echo.

REM 配置检查
if not exist .env (
    echo ❌ 错误：未找到 .env 配置文件
    echo 请先创建 .env 文件并配置 RAGFLOW_BASE_URL 和 RAGFLOW_API_KEY
    exit /b 1
)

echo ✅ 配置文件已找到
echo.

REM ==================== 解析示例 ====================
echo 📚 解析工具 (resolve.py) 使用示例：
echo ----------------------------------------
echo.

echo 1️⃣  预览所有待解析的测试库（不实际执行）
echo    python resolve.py --only 测试 --dry-run
echo.

echo 2️⃣  解析特定知识库
echo    python resolve.py --names "法律法规测试"
echo.

echo 3️⃣  解析所有包含'法律'关键词的知识库
echo    python resolve.py --only 法律
echo.

echo 4️⃣  强制重新解析所有文档
echo    python resolve.py --names "法律法规测试" --force
echo.

echo 5️⃣  解析所有知识库（小批次，慢速安全）
echo    python resolve.py --all --batch 20
echo.

REM ==================== 取消解析示例 ====================
echo 🗑️  取消解析工具 (cancel_parse.py) 使用示例：
echo ----------------------------------------
echo.

echo 1️⃣  预览将要取消解析的知识库
echo    python cancel_parse.py --only 测试 --dry-run
echo.

echo 2️⃣  取消特定知识库的解析
echo    python cancel_parse.py --names "法律法规测试"
echo.

echo 3️⃣  取消所有测试库，但保留生产库（反选）
echo    python cancel_parse.py --all --exclude 生产 --exclude 重要
echo.

echo 4️⃣  仅清理已解析的文档
echo    python cancel_parse.py --only 测试 --parsed-only
echo.

echo 5️⃣  取消所有知识库的解析（危险操作！）
echo    python cancel_parse.py --all --dry-run  # 先预览
echo    python cancel_parse.py --all            # 确认后执行
echo.

REM ==================== 组合使用示例 ====================
echo 🔄 组合使用示例 - 完整的重置流程：
echo ----------------------------------------
echo.

echo 场景：重置某个知识库并重新解析
echo.
echo 步骤 1: 预览当前状态
echo    python cancel_parse.py --names "法律法规测试" --dry-run
echo.
echo 步骤 2: 取消当前解析
echo    python cancel_parse.py --names "法律法规测试"
echo.
echo 步骤 3: 重新解析
echo    python resolve.py --names "法律法规测试" --force
echo.

REM ==================== 快速开始 ====================
echo 🚀 快速开始：
echo ----------------------------------------
echo.
echo 选择操作：
echo.
echo [1] 预览解析测试库
echo [2] 执行解析测试库
echo [3] 取消解析测试库
echo [4] 重置测试库（取消+重新解析）
echo [5] 查看帮助
echo [0] 退出
echo.

set /p choice="请输入选项 (0-5): "

if "%choice%"=="1" (
    echo.
    echo 正在预览...
    python resolve.py --only 测试 --dry-run
    goto end
)

if "%choice%"=="2" (
    echo.
    echo 正在执行解析...
    python resolve.py --only 测试
    goto end
)

if "%choice%"=="3" (
    echo.
    echo 正在取消解析...
    python cancel_parse.py --only 测试
    goto end
)

if "%choice%"=="4" (
    echo.
    echo 正在重置测试库...
    echo 步骤 1/2: 取消现有解析
    python cancel_parse.py --only 测试
    echo.
    echo 步骤 2/2: 重新解析
    python resolve.py --only 测试 --force
    goto end
)

if "%choice%"=="5" (
    echo.
    echo 显示帮助信息：
    echo.
    python resolve.py --help
    echo.
    python cancel_parse.py --help
    goto end
)

if "%choice%"=="0" (
    echo.
    echo 退出程序
    goto end
)

echo.
echo ❌ 无效选项，请重新运行脚本
echo.

:end
echo.
echo =========================================
echo   更多信息请查看 README.md
echo =========================================
pause

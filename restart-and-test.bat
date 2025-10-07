@echo off
chcp 65001 >nul
echo ========================================
echo RAGFlow 混合认证方案 - 重启和测试脚本
echo ========================================
echo.

:: 检查 Docker 是否运行
echo [1/6] 检查 Docker 状态...
docker ps >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker 未运行，正在启动 Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo ⏳ 等待 Docker 启动 (30秒)...
    timeout /t 30 /nobreak >nul
) else (
    echo ✅ Docker 已运行
)

:: 进入 docker 目录
cd /d D:\workspace\ragflow\docker
echo.

:: 显示当前修改
echo [2/6] 显示代码修改摘要...
echo 📝 已应用混合认证方案:
echo    - API Key 认证: 使用 beta_token (0次DB查询)
echo    - Session 认证: 使用 access_token (0次DB查询)
echo.

:: 停止容器
echo [3/6] 停止 RAGFlow 容器...
docker-compose stop ragflow
echo.

:: 启动容器
echo [4/6] 启动 RAGFlow 容器...
docker-compose start ragflow
echo.

:: 等待服务启动
echo [5/6] 等待服务启动 (10秒)...
timeout /t 10 /nobreak >nul
echo.

:: 检查容器状态
echo [6/6] 验证部署...
docker ps | findstr ragflow
if %errorlevel% neq 0 (
    echo ❌ RAGFlow 容器未运行
    echo.
    echo 查看日志:
    docker logs ragflow-server --tail 50
    pause
    exit /b 1
)

echo.
echo ✅ RAGFlow 已重启成功！
echo.
echo ========================================
echo 📊 验证步骤
echo ========================================
echo.
echo 1. 查看启动日志:
echo    docker logs ragflow-server --tail 50
echo.
echo 2. 检查环境变量:
echo    docker exec -it ragflow-server env ^| findstr MODEL_CARDS_API_URL
echo.
echo 3. 测试 API 端点:
echo    打开浏览器访问: https://rag.limitee.cn/free-chat
echo    按 F12 打开开发者工具
echo    刷新页面
echo    查看 Network 标签中的 model_cards 请求
echo.
echo 4. 预期结果:
echo    - 状态码: 200 (不再是 102)
echo    - 响应: {"code":0,"data":[...]}
echo    - 控制台日志: [ModelCards] Using access_token from session auth
echo.
echo ========================================
pause

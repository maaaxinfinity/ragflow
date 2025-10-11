在开始分析问题之前，你应该查找.memory中有关项目的所有文件，构建基本上下文
---
curl 'https://rag.limitee.cn/v1/user/info?user_id=c06096ce9e3411f09866eedd5edd0033' \
  -H 'authority: rag.limitee.cn' \
  -H 'accept: */*' \
  -H 'accept-language: zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6' \
  -H 'authorization: Bearer null' \
  -H 'cookie: session=gKnS5JSXlq-wduVvoY3juN-gu_C0Ysl2JWpYfZvu1AM' \
  -H 'referer: https://rag.limitee.cn/free-chat?user_id=c06096ce9e3411f09866eedd5edd0033&dialog_id=2f06dd949fd011f08df4fa3a40a9afac' \
  -H 'sec-ch-ua: "Not_A Brand";v="8", "Chromium";v="120", "Microsoft Edge";v="120"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Windows"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: same-origin' \
  -H 'user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0' \
  --compressed
===
curl 'https://rag.limitee.cn/v1/dialog/next?keywords=&page_size=50&page=1' \
  -H 'authority: rag.limitee.cn' \
  -H 'accept: application/json, text/plain, */*' \
  -H 'accept-language: zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6' \
  -H 'authorization: ImI4MTdlNDk0YTVkZDExZjBhYjIzNzYwNjBlY2E1ZDY5Ig.aOkLLg.frxovpQMjCaXZ-oMJgEMEabF1Rc' \
  -H 'content-type: application/json' \
  -H 'cookie: session=gKnS5JSXlq-wduVvoY3juN-gu_C0Ysl2JWpYfZvu1AM' \
  -H 'origin: https://rag.limitee.cn' \
  -H 'referer: https://rag.limitee.cn/free-chat?user_id=c06096ce9e3411f09866eedd5edd0033&dialog_id=2f06dd949fd011f08df4fa3a40a9afac' \
  -H 'sec-ch-ua: "Not_A Brand";v="8", "Chromium";v="120", "Microsoft Edge";v="120"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Windows"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: same-origin' \
  -H 'user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0' \
  --data-raw '{}' \
  --compressed
===
curl 'https://rag.limitee.cn/v1/free_chat/settings?user_id=c06096ce9e3411f09866eedd5edd0033' \
  -H 'authority: rag.limitee.cn' \
  -H 'accept: */*' \
  -H 'accept-language: zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6' \
  -H 'authorization: ImI4MTdlNDk0YTVkZDExZjBhYjIzNzYwNjBlY2E1ZDY5Ig.aOkLLg.frxovpQMjCaXZ-oMJgEMEabF1Rc' \
  -H 'cookie: session=gKnS5JSXlq-wduVvoY3juN-gu_C0Ysl2JWpYfZvu1AM' \
  -H 'referer: https://rag.limitee.cn/free-chat?user_id=c06096ce9e3411f09866eedd5edd0033&dialog_id=2f06dd949fd011f08df4fa3a40a9afac' \
  -H 'sec-ch-ua: "Not_A Brand";v="8", "Chromium";v="120", "Microsoft Edge";v="120"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Windows"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: same-origin' \
  -H 'user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0' \
  --compressed
===
curl 'https://rag.limitee.cn/v1/user/tenant_info' \
  -H 'authority: rag.limitee.cn' \
  -H 'accept: */*' \
  -H 'accept-language: zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6' \
  -H 'authorization: ImI4MTdlNDk0YTVkZDExZjBhYjIzNzYwNjBlY2E1ZDY5Ig.aOkLLg.frxovpQMjCaXZ-oMJgEMEabF1Rc' \
  -H 'cookie: session=gKnS5JSXlq-wduVvoY3juN-gu_C0Ysl2JWpYfZvu1AM' \
  -H 'referer: https://rag.limitee.cn/free-chat?user_id=c06096ce9e3411f09866eedd5edd0033&dialog_id=2f06dd949fd011f08df4fa3a40a9afac' \
  -H 'sec-ch-ua: "Not_A Brand";v="8", "Chromium";v="120", "Microsoft Edge";v="120"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Windows"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: same-origin' \
  -H 'user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0' \
  --compressed
===
curl 'https://rag.limitee.cn/v1/kb/list' \
  -H 'authority: rag.limitee.cn' \
  -H 'accept: application/json' \
  -H 'accept-language: zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6' \
  -H 'authorization: ImI4MTdlNDk0YTVkZDExZjBhYjIzNzYwNjBlY2E1ZDY5Ig.aOkLLg.frxovpQMjCaXZ-oMJgEMEabF1Rc' \
  -H 'content-type: application/json;charset=UTF-8' \
  -H 'cookie: session=gKnS5JSXlq-wduVvoY3juN-gu_C0Ysl2JWpYfZvu1AM' \
  -H 'origin: https://rag.limitee.cn' \
  -H 'referer: https://rag.limitee.cn/free-chat?user_id=c06096ce9e3411f09866eedd5edd0033&dialog_id=2f06dd949fd011f08df4fa3a40a9afac' \
  -H 'sec-ch-ua: "Not_A Brand";v="8", "Chromium";v="120", "Microsoft Edge";v="120"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Windows"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: same-origin' \
  -H 'user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0' \
  --data-raw '{}' \
  --compressed
===
curl 'https://rag.limitee.cn/v1/user/info' \
  -H 'authority: rag.limitee.cn' \
  -H 'accept: */*' \
  -H 'accept-language: zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6' \
  -H 'authorization: ImI4MTdlNDk0YTVkZDExZjBhYjIzNzYwNjBlY2E1ZDY5Ig.aOkLLg.frxovpQMjCaXZ-oMJgEMEabF1Rc' \
  -H 'cookie: session=gKnS5JSXlq-wduVvoY3juN-gu_C0Ysl2JWpYfZvu1AM' \
  -H 'referer: https://rag.limitee.cn/free-chat?user_id=c06096ce9e3411f09866eedd5edd0033&dialog_id=2f06dd949fd011f08df4fa3a40a9afac' \
  -H 'sec-ch-ua: "Not_A Brand";v="8", "Chromium";v="120", "Microsoft Edge";v="120"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Windows"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: same-origin' \
  -H 'user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0' \
  --compressed
===
这几个接口全部认证失败，请检查后端实现，响应全部是：
{
  "code": 109,
  "message": "Authentication required. Please login or provide valid API key."
}

---

在freechat的左侧sidebar中，我要你在前端实现一个展示对话，即draft对话，他本质是一个展示页，用户可以在底部输入，然后自动创建对话，当用户进入freechat端点时默认访问该


现在你需要阅读.todo文件夹下的所有内容，继续完成要求

流式 团队管理 api接口注册 

更准确来说 我想把目前的lobe-chat裁剪 ，然后对接我们freechat和ragflow的后端api
请应用修改，切记忠实于源码 不要臆想。改完记得检查，并将改动记录写入.memory中，能在原md上修改就修改，除非有必要新建文件
在本地项目lobe-chat中 有实现我们在freechat中实现的功能 你看看能不能将lobe-chat的必要逻辑和页面直接移植到我们这边


比如说lobe也有助理的实现 他也是存的一些参数 freechat这边也是 就可以修改freechat这边的后端来做到和lobe一样优秀
lobe的话题也是 他想实现的和我在freechat想实现的一致，有优秀的话题管理 那么freechat这边就可以对接
但是我不需要lobe中的很多功能 比如说什么语音输入，模型选择也不需要，我们通过freechat中的botapi拿到了相关的凭证
其实最主要是freechat这边的状态管理 交互逻辑不够优秀，可以参考lobe
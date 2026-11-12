# ccp-observe proxy

零第三方依赖的本地观测代理（Python 3.9+ 标准库）。它承担这些事：

1. 把 Claude Code / Codex 的请求**按规则路由**到用户配置的多个供应商；
2. 客户端与上游协议不一致时**转换请求与流式响应**；
3. 逐字节透传 SSE，并在流中增量解析，检测 tool_use 截断；
4. 保留**完整请求/响应抓包**（头部脱敏、体积裁剪）；
5. 把**按天用量落盘**，重启后仍能看昨天与上周的数字；
6. 托管面板静态文件并提供 `/_ccp/api/*` 数据接口。

同目录的 `ccp_launch.py` 是 `ccp` 命令的实现：读取 `~/.claude/settings.json` 导入上游与鉴权、确保代理在跑、再以 `claude --settings <临时文件>` 启动客户端。

## 启动

```bash
python proxy.py                                  # 127.0.0.1:8787
python proxy.py --port 8788 --open               # 换端口并打开面板
python proxy.py --upstream https://example.internal/v1
```

启动成功会打印一行供桌面端与脚本识别的握手：

```
CCP_READY http://127.0.0.1:8787/_ccp/ pid=12345
```

端口被占用时自动顺延（默认尝试 `port..port+19`），握手行里是实际绑定的端口，stderr 会提示 `端口 8787 已占用…已改用端口 8788`。`--no-port-scan` 可关闭该行为，此时端口冲突直接报错退出。

## 供应商与路由

`ccp/router.py` 按下面的顺序解析出一条决策（`provider / base_url / auth_header / upstream_protocol / translate / source`）：

```
routes（模型或路径 glob，自上而下取第一条） → 供应商 models[] → default_provider → 旧版单上游 → 未配置
```

规则写法两种都接受：

```json
{"routes": [{"match": "deepseek-*", "provider": "gateway-a"},
            {"match": "/v1/chat/*", "provider": "gateway-b"}]}
```

`explain()` 是纯函数干跑，`GET /_ccp/api/route?model=...` 直接返回决策、命中的规则以及全部供应商列表，面板的路由页据此做命中预览。`validate_rule()` 只做语法校验，不碰网络。

## 协议路由

| 客户端路径 | 判定协议 | 上游路径 |
| --- | --- | --- |
| `/v1/messages` | Anthropic Messages | 保留原路径 |
| `/v1/chat/completions` | OpenAI Chat Completions | 保留原路径 |

路径无法判断时回退到请求头（`x-api-key` / `anthropic-version` vs `Authorization: Bearer`）与请求体结构。也可在配置里把 `client_protocol` 固定为 `anthropic` 或 `openai`。

每个供应商自己声明 `protocol`：`anthropic` / `openai` / `auto`。`auto` 表示跟随客户端，不需要转换。

## 协议转换

`ccp/translate.py`，由全局 `translate` 开关控制（默认开）。当客户端协议与供应商协议不一致时：

| 方向 | 请求 | 流式响应 |
| --- | --- | --- |
| Anthropic → OpenAI | `system` / `messages` / `tools` / `tool_use` / `tool_result` / `max_tokens` 映射为 chat completions 结构 | `content_block_start/delta/stop` → `choices[].delta`（含 `tool_calls` 增量） |
| OpenAI → Anthropic | 反向映射 | `choices[].delta` → `content_block_*` |

目标路径也随之改写：转成 OpenAI 时打 `/v1/chat/completions`，转成 Anthropic 时打 `/v1/messages`。

**硬约束**：上游没有发出结束事件就断流时，`close()` 不会补一个伪造的 finish —— 补了就等于把截断洗成正常收尾，面板的截断率会失真。截断检测始终跑在**客户端方言**的字节上，所以转换与否都不影响归因结果。

## 上游地址（供应商 + 旧版单上游）

供应商模式：

- `providers[]`：`id / name / protocol / base_url / auth_header / models / enabled / note`；
- `routes[]`：有序规则，见上一节；
- `default_provider`：规则和模型列表都没命中时的兜底供应商。

旧版单上游仍然生效，仅在没有供应商命中时使用：

- `upstream`：通用地址，两个协议共用。
- `upstream_anthropic` / `upstream_openai`：分协议覆盖，留空回落通用地址。
- 地址可以带或不带 `/v1`（会自动去重）；省略 scheme 时补 `https://`。
- `upstream_auth_header` 形如 `Authorization: Bearer sk-xxx`，覆盖客户端带来的同名头。

配置里没有任何上游时，代理返回 502 + 中文引导文案，不会把请求打到任何默认地址。发往上游前会去掉与目标方言冲突的头（例如转成 OpenAI 时去掉 `anthropic-version`），并把鉴权头换成供应商自己的。

## 重试

对 `408 / 409 / 425 / 429 / 5xx` 与连接层错误做线性退避重试（默认 3 次、600ms 起）。最终成功且中间失败过的请求记为 `retried_ok`，面板上体现为「重试后成功」。

`4xx` 默认快速失败，但有些网关在负载下会对**完全合法**的请求回 `400 invalid JSON request body`。`retry_400_patterns`（默认 `["invalid JSON request body"]`）里的子串命中时按可重试处理；留空数组则所有 400 都不重试。

`/v1/messages/count_tokens` 默认由代理本地估算（`local_count_tokens=true`），不转发给上游 —— 多数网关根本没有这个端点，而客户端只需要一个量级。估算值 = 请求体字符数 / 4。

## 用量台账

`ccp/usage.py` 按天把用量写进 `state/usage.json`，字段与请求台账一致（requests / success / failed / truncated / retried_ok / input_tokens / output_tokens / cache_read / cache_write / duration_ms），并同时维护 `total`、`models{}`、`providers{}` 三组聚合。

- 内存里的请求环形缓冲只有最近 N 条，重启就没了；用量台账是独立的一份，关掉代理也不影响。
- 写入是去抖的（默认 5 秒），正常退出时 `server_close()` 强制落盘；崩溃最多丢 5 秒的量。
- 默认保留 120 天（`usage_retain_days`），`usage_enabled=false` 可整体关闭。
- `GET /_ccp/api/usage?days=30` 返回补齐空档的每日序列 + 按模型/供应商的窗口累计 + `summary`（含 `today` 与 `active_days`）。

## 截断检测

`ccp/truncation.py` 在流式转发的同时累积 tool call：

- Anthropic：`content_block_start` 开块 → `input_json_delta` 拼 `partial_json` → `content_block_stop` 收块；`message_delta.stop_reason` 判断 `max_tokens`。
- OpenAI：`choices[].delta.tool_calls[].function.arguments` 拼接，`finish_reason` 收口。

流结束后用 JSON 完整性校验判定，原因包括：`client_aborted`、`upstream_error_*`、`max_tokens`、`stream_incomplete`、`stream_error`、`invalid_tool_json`。每个截断事件保留残缺片段（最长 16 KB，中间截断保留首尾），面板可直接展开查看。

### 归因

`stats.py` 把原因映射到责任侧，面板据此给出「该找谁」的结论：

| 原因 | 责任侧 |
| --- | --- |
| `max_tokens`、`invalid_tool_json` | 模型侧 |
| `stream_incomplete`、`stream_error`、`upstream_error_*` | 网关侧 |
| `client_aborted` | 本地链路 |

仅单模型出问题而同批存在干净模型时归为模型侧；多模型同时截断且以网关原因为主时归为网关侧。OpenAI 的 `finish_reason: "length"` 按 `max_tokens` 计入模型侧。

## 抓包

`ccp/capture.py` 维护一个环形缓冲（默认 200 条，`capture_limit` 可调），保留每次经过代理的请求与响应：

- 请求头 / 响应头里的 `authorization` / `x-api-key` / `api-key` / `cookie` 等一律替换为 `***redacted***`；
- 响应体超过 `capture_body_limit`（默认 256 KB）时裁剪并标记 `clipped`，未裁剪的 JSON 自动美化；
- 每条记录带 `provider_id / route_source / upstream_protocol / translated / truncated / owner`，所以能在抓包里直接看出「这条走了谁、转没转、为什么截断」。

`GET /_ccp/api/capture` 列表、`GET /_ccp/api/capture/<id>` 详情。`capture_enabled=false` 时完全不占用这份内存。

## 配置优先级

```
默认值  <  state/config.json  <  CCP_* 环境变量
```

`POST /_ccp/api/config` 接受部分字段，校验后原子写入（`os.replace`），立即生效。

## 测试

```bash
python -m unittest discover -s tests -v
```

覆盖：双协议路由、供应商/路由解析（含 disabled 与 auto 协议）、Anthropic ⇄ OpenAI 双向转换与流式 shim（含「上游未收尾就不伪造收尾」）、抓包脱敏与环形缓冲、SSE 透传、截断检测、重试后成功、模型映射、配置往返、缺失上游引导、静态资源与 302 跳转、分时段聚合与上下文序列、用量台账（持久化往返 / 空档补齐 / 按模型与供应商聚合 / 保留期裁剪 / 损坏文件容错），以及扫描器单元测试。

## 演示

```bash
python demo_upstream.py --port 9901 --model demo-model-a --model demo-model-b &
python proxy.py --upstream http://127.0.0.1:9901 &
python seed_demo.py --requests 40 --model demo-model-a         # 生成双协议流量
```

制造「只有某一个模型有问题」的场景，用来验证归因与诊断卡：

```bash
python demo_upstream.py --port 9901 --truncate-cut model --truncate-model demo-model-b \
    --model demo-model-a --model demo-model-b
```

- `--truncate-cut gateway|model|mixed`：`gateway` 让流在半途断开，`model` 以 `max_tokens` / `length` 正常收尾，`mixed`（默认）两者随机。
- `--truncate-model ID`：只让该模型截断，其余模型保持干净。

`--model` 可重复；不传时用 `demo-anthropic-model` / `demo-openai-model` 这类中性占位名，
面板展示的模型卡片全部来自实际流量的 `model` 字段，不存在写死的模型列表。

## Windows 注意事项

监听时使用 `SO_EXCLUSIVEADDRUSE` 且关闭 `SO_REUSEADDR`，避免第二个进程静默共用同一端口导致流量被拆分。

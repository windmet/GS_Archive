# Translation Studio v1 试验样本

[`cases.json`](cases.json) 是从当前 Reader 确定性抽取的 **200 条未人工评判候选**：8 个域各 25 条，记录原文、受保护的 Producer 槽、kind、Reader 行和稳定来源身份。它覆盖各域可用的文本类型，并优先包含两类 Producer 槽、字面职业词、换行、长句和括号句。样本不是金标准译文，也不计入正式翻译进度。

运行 `node scripts/generate-ai-studio-benchmark.mjs --check` 核对样本仍与 Reader manifest、来源 hash 和确定性选取结果一致。先用它试译、人工记录角色语气与排版问题，再冻结提示词和语言 QA 阈值；不得把模型第一次回答直接标为 `reviewed` 或 `final`。

# AI Reading Setup

The app calls AI from the `baziAi` CloudBase cloud function. The browser never receives the model API key.

## Deploy

Deploy this function with the existing CloudBase functions:

```text
cloudfunctions/baziAi
```

## Environment Variables

Configure these environment variables on the `baziAi` cloud function:

```env
AI_API_KEY=your-model-api-key
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=qwen3.5-plus
```

`AI_BASE_URL` must be OpenAI-compatible and should not include `/chat/completions`; the function appends that path automatically.

You can also use the `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `OPENAI_MODEL` aliases.

## Notes

- The frontend calls `baziAi` through the existing CloudBase JS SDK.
- Single-chart reading sends the current profile, summary, and bazi result.
- Compatibility reading sends the two selected records and the local compatibility analysis.
- Each logged-in account can generate 10 AI readings per China calendar day.
- The function writes usage rows to the `bazi_ai_usage` collection.
- Saved single-chart AI readings are written back to the matching `bazi_profiles` record. Saved compatibility AI readings are written by `baziRecords` to the `bazi_ai_readings` collection.
- The output is capped at 1300 tokens to control resource-point usage.
- If the button returns `请先在 baziAi 云函数环境变量中配置 AI_API_KEY。`, the function deployed correctly but the model key is missing.

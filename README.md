# Paperless-AI Fork

This is my (personal) fork of [Paperless-AI](https://github.com/clusterzx/paperless-ai).

## What's different?

### Full control over the system prompt
The 'prompt description' you enter into the Settings is **exactly** what the LLM will see (plus the document text, of course).  

The original Paperless-AI overrides the prompt in several ways, which wasn't desirable for my use case.
This will generally be fine for "bigger" models (OpenAI 4o, Google Gemini, etc.), but for tiny models (qwen3:0.6B, etc.) it can lead to unexpected results.

For this reason, I've only patched Ollama's service, since self-hosted models are usually smaller and more sensitive to prompt changes.

### Support for placeholders
Want the LLM to stick to tags & correspondents you already have in Paperless-AI?  
Use the following placeholders in your prompt:
- `%EXISTINGCORRESPONDENTS%`
- `%EXISTINGTAGS%`

Example:
```markdown
Analyze the document and assign tags from the following list: %EXISTINGTAGS%. 
Assign correspondents from the following list: %EXISTINGCORRESPONDENTS%.
```

Don't want the LLM to assign tags or correspondents? Just leave the snippet out of your prompt.

⚠️ The settings "AI Restrictions" from the UI will be **ignored**. Adding the placeholders (or not) is how you control what the LLM receives.

### Clean split between System and User prompts
Your document's text will be the user prompt, nothing more and nothing less.  
Your system prompt is what's entered into "Prompt description" in the Settings, optionally with the placeholders mentioned above.
const {
  calculateTokens,
  calculateTotalPromptTokens,
  truncateToTokenLimit,
  writePromptToFile,
} = require("./serviceUtils");
const OpenAI = require("openai");
const config = require("../config/config");
const paperlessService = require("./paperlessService");
const fs = require("fs").promises;
const path = require("path");
const { model } = require("./ollamaService");

class OpenAIService {
  constructor() {
    this.client = null;
  }

  initialize() {
    if (!this.client && config.aiProvider === "ollama") {
      this.client = new OpenAI({
        baseURL: config.ollama.apiUrl + "/v1",
        apiKey: "ollama",
      });
    } else if (!this.client && config.aiProvider === "custom") {
      this.client = new OpenAI({
        baseURL: config.custom.apiUrl,
        apiKey: config.custom.apiKey,
      });
    } else if (!this.client && config.aiProvider === "openai") {
      if (!this.client && config.openai.apiKey) {
        this.client = new OpenAI({
          apiKey: config.openai.apiKey,
        });
      }
    }
  }

  async analyzeDocument(
    content,
    existingTags = [],
    existingCorrespondentList = [],
    id,
    customPrompt = null,
    options = {},
  ) {
    const cachePath = path.join("./public/images", `${id}.png`);
    try {
      this.initialize();
      const now = new Date();
      const timestamp = now.toLocaleString("de-DE", {
        dateStyle: "short",
        timeStyle: "short",
      });

      if (!this.client) {
        throw new Error("OpenAI client not initialized");
      }

      // Handle thumbnail caching
      try {
        await fs.access(cachePath);
        console.log("[DEBUG] Thumbnail already cached");
      } catch (err) {
        console.log("Thumbnail not cached, fetching from Paperless");

        const thumbnailData = await paperlessService.getThumbnailImage(id);

        if (!thumbnailData) {
          console.warn("Thumbnail nicht gefunden");
        }

        await fs.mkdir(path.dirname(cachePath), { recursive: true });
        await fs.writeFile(cachePath, thumbnailData);
      }

      // Format existing tags
      let existingTagsList = existingTags.join(", ");

      // Get external API data if available and validate it
      let externalApiData = options.externalApiData || null;
      let validatedExternalApiData = null;

      if (externalApiData) {
        try {
          validatedExternalApiData =
            await this._validateAndTruncateExternalApiData(externalApiData);
          console.log("[DEBUG] External API data validated and included");
        } catch (error) {
          console.warn(
            "[WARNING] External API data validation failed:",
            error.message,
          );
          validatedExternalApiData = null;
        }
      }

      let systemPrompt = "";
      let promptTags = "";
      const model = process.env.OPENAI_MODEL;

      // Parse CUSTOM_FIELDS from environment variable
      let customFieldsObj;
      try {
        customFieldsObj = JSON.parse(process.env.CUSTOM_FIELDS);
      } catch (error) {
        console.error("Failed to parse CUSTOM_FIELDS:", error);
        customFieldsObj = { custom_fields: [] };
      }

      // Generate custom fields template for the prompt
      const customFieldsTemplate = {};

      customFieldsObj.custom_fields.forEach((field, index) => {
        customFieldsTemplate[index] = {
          field_name: field.value,
          value: "Fill in the value based on your analysis",
        };
      });

      // Convert template to string for replacement and wrap in custom_fields
      const customFieldsStr =
        '"custom_fields": ' +
        JSON.stringify(customFieldsTemplate, null, 2)
          .split("\n")
          .map((line) => "    " + line) // Add proper indentation
          .join("\n");

      // Get system prompt and model
      if (
        config.useExistingData === "yes" &&
        config.restrictToExistingTags === "no" &&
        config.restrictToExistingCorrespondents === "no"
      ) {
        systemPrompt =
          `
        Prexisting tags: ${existingTagsList}\n\n
        Prexisiting correspondent: ${existingCorrespondentList}\n\n
        ` +
          process.env.SYSTEM_PROMPT +
          "\n\n" +
          config.mustHavePrompt.replace("%CUSTOMFIELDS%", customFieldsStr);
        promptTags = "";
      } else {
        config.mustHavePrompt = config.mustHavePrompt.replace(
          "%CUSTOMFIELDS%",
          customFieldsStr,
        );
        systemPrompt =
          process.env.SYSTEM_PROMPT + "\n\n" + config.mustHavePrompt;
        promptTags = "";
      }

      // Build restriction prompts with validation
      const restrictionPrompts = this._buildRestrictionPrompts(
        existingTags,
        existingCorrespondentList,
        config,
        options,
      );
      systemPrompt += restrictionPrompts;

      // Include validated external API data if available
      if (validatedExternalApiData) {
        systemPrompt += `\n\nAdditional context from external API:\n${validatedExternalApiData}`;
      }

      if (process.env.USE_PROMPT_TAGS === "yes") {
        promptTags = process.env.PROMPT_TAGS;
        systemPrompt =
          `
        Take these tags and try to match one or more to the document content.\n\n
        ` + config.specialPromptPreDefinedTags;
      }

      if (customPrompt) {
        console.log(
          "[DEBUG] Replace system prompt with custom prompt via WebHook",
        );
        systemPrompt = customPrompt + "\n\n" + config.mustHavePrompt;
      }

      // Calculate tokens AFTER all prompt modifications are complete
      const totalPromptTokens = await calculateTotalPromptTokens(
        systemPrompt,
        process.env.USE_PROMPT_TAGS === "yes" ? [promptTags] : [],
        model,
      );

      const maxTokens = Number(config.tokenLimit);
      const reservedTokens = totalPromptTokens + Number(config.responseTokens);
      const availableTokens = maxTokens - reservedTokens;

      // Validate that we have positive available tokens
      if (availableTokens <= 0) {
        console.warn(
          `[WARNING] No available tokens for content. Reserved: ${reservedTokens}, Max: ${maxTokens}`,
        );
        throw new Error(
          "Token limit exceeded: prompt too large for available token limit",
        );
      }

      console.log(
        `[DEBUG] Token calculation - Prompt: ${totalPromptTokens}, Reserved: ${reservedTokens}, Available: ${availableTokens}`,
      );
      console.log(
        `[DEBUG] Use existing data: ${config.useExistingData}, Restrictions applied based on useExistingData setting`,
      );
      console.log(
        `[DEBUG] External API data: ${validatedExternalApiData ? "included" : "none"}`,
      );

      const truncatedContent = await truncateToTokenLimit(
        content,
        availableTokens,
        model,
      );

      await writePromptToFile(systemPrompt, truncatedContent);

      const response = await this.client.chat.completions.create({
        model: model,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: truncatedContent,
          },
        ],
        ...(model !== "o3-mini" && { temperature: 0.3 }),
      });

      if (!response?.choices?.[0]?.message?.content) {
        throw new Error("Invalid API response structure");
      }

      console.log(`[DEBUG] [${timestamp}] OpenAI request sent`);
      console.log(
        `[DEBUG] [${timestamp}] Total tokens: ${response.usage.total_tokens}`,
      );

      const usage = response.usage;
      const mappedUsage = {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      };

      let jsonContent = response.choices[0].message.content;
      jsonContent = jsonContent
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      let parsedResponse;
      try {
        parsedResponse = JSON.parse(jsonContent);
        //write to file and append to the file (txt)
        fs.appendFile("./logs/response.txt", jsonContent, (err) => {
          if (err) throw err;
        });
      } catch (error) {
        console.error("Failed to parse JSON response:", error);
        throw new Error("Invalid JSON response from API");
      }

      if (
        !parsedResponse ||
        !Array.isArray(parsedResponse.tags) ||
        typeof parsedResponse.correspondent !== "string"
      ) {
        throw new Error(
          "Invalid response structure: missing tags array or correspondent string",
        );
      }

      return {
        document: parsedResponse,
        metrics: mappedUsage,
        truncated: truncatedContent.length < content.length,
      };
    } catch (error) {
      console.error("Failed to analyze document:", error);
      return {
        document: { tags: [], correspondent: null },
        metrics: null,
        error: error.message,
      };
    }
  }

  /**
   * Build restriction prompts with validation for tags and correspondents
   * @param {Array} existingTags - Array of existing tags
   * @param {Array|string} existingCorrespondentList - List of existing correspondents
   * @param {Object} config - Configuration object
   * @param {Object} options - Options object
   * @returns {string} - Built restriction prompts
   */
  _buildRestrictionPrompts(
    existingTags,
    existingCorrespondentList,
    config,
    options,
  ) {
    let restrictions = "";

    // Use existing data setting controls both injection and restriction behavior
    const useExistingData = config.useExistingData === "yes";

    // Handle tag restrictions - only apply if useExistingData is enabled
    if (useExistingData && config.restrictToExistingTags === "yes") {
      const existingTagsList = existingTags.map((tag) => tag.name).join(", ");

      if (existingTagsList && existingTagsList.trim() !== "") {
        restrictions += `\n\nIMPORTANT: You MUST ONLY use tags from this list: ${existingTagsList}. Do not suggest any tags that are not in this list.`;
      } else {
        console.warn(
          "[WARNING] Tag restriction enabled but no existing tags provided",
        );
        restrictions += `\n\nIMPORTANT: No existing tags available for restriction. Please provide minimal, relevant tags.`;
      }
    }

    // Handle correspondent restrictions - only apply if useExistingData is enabled
    if (useExistingData && config.restrictToExistingCorrespondents === "yes") {
      const correspondentListStr = Array.isArray(existingCorrespondentList)
        ? existingCorrespondentList.join(", ")
        : existingCorrespondentList;

      if (correspondentListStr && correspondentListStr.trim() !== "") {
        restrictions += `\n\nIMPORTANT: You MUST ONLY use correspondents from this list: ${correspondentListStr}. Do not suggest any correspondent that is not in this list.`;
      } else {
        console.warn(
          "[WARNING] Correspondent restriction enabled but no existing correspondents provided",
        );
        restrictions += `\n\nIMPORTANT: No existing correspondents available for restriction. Leave correspondent empty or use a generic value.`;
      }
    }

    return restrictions;
  }

  /**
   * Validate and truncate external API data to prevent token overflow
   * @param {any} apiData - The external API data to validate
   * @param {number} maxTokens - Maximum tokens allowed for external data (default: 500)
   * @returns {string} - Validated and potentially truncated data string
   */
  async _validateAndTruncateExternalApiData(apiData, maxTokens = 500) {
    if (!apiData) {
      return null;
    }

    const dataString =
      typeof apiData === "object"
        ? JSON.stringify(apiData, null, 2)
        : String(apiData);

    // Calculate tokens for the data
    const dataTokens = await calculateTokens(
      dataString,
      process.env.OPENAI_MODEL,
    );

    if (dataTokens > maxTokens) {
      console.warn(
        `[WARNING] External API data (${dataTokens} tokens) exceeds limit (${maxTokens}), truncating`,
      );
      return await truncateToTokenLimit(
        dataString,
        maxTokens,
        process.env.OPENAI_MODEL,
      );
    }

    console.log(`[DEBUG] External API data validated: ${dataTokens} tokens`);
    return dataString;
  }

  async analyzePlayground(content, prompt) {
    const musthavePrompt = `
    Return the result EXCLUSIVELY as a JSON object. The Tags and Title MUST be in the language that is used in the document.:  
        {
          "title": "xxxxx",
          "correspondent": "xxxxxxxx",
          "tags": ["Tag1", "Tag2", "Tag3", "Tag4"],
          "document_date": "YYYY-MM-DD",
          "language": "en/de/es/..."
        }`;

    try {
      this.initialize();
      const now = new Date();
      const timestamp = now.toLocaleString("de-DE", {
        dateStyle: "short",
        timeStyle: "short",
      });

      if (!this.client) {
        throw new Error("OpenAI client not initialized - missing API key");
      }

      // Calculate total prompt tokens including musthavePrompt
      const totalPromptTokens = await calculateTotalPromptTokens(
        prompt + musthavePrompt, // Combined system prompt
      );

      // Calculate available tokens
      const maxTokens = Number(config.tokenLimit);
      const reservedTokens = totalPromptTokens + Number(config.responseTokens); // Reserve for response
      const availableTokens = maxTokens - reservedTokens;

      // Truncate content if necessary
      const truncatedContent = await truncateToTokenLimit(
        content,
        availableTokens,
      );
      const model = process.env.OPENAI_MODEL;
      // Make API request
      const response = await this.client.chat.completions.create({
        model: model,
        messages: [
          {
            role: "system",
            content: prompt + musthavePrompt,
          },
          {
            role: "user",
            content: truncatedContent,
          },
        ],
        ...(model !== "o3-mini" && { temperature: 0.3 }),
      });

      // Handle response
      if (!response?.choices?.[0]?.message?.content) {
        throw new Error("Invalid API response structure");
      }

      // Log token usage
      console.log(`[DEBUG] [${timestamp}] OpenAI request sent`);
      console.log(
        `[DEBUG] [${timestamp}] Total tokens: ${response.usage.total_tokens}`,
      );

      const usage = response.usage;
      const mappedUsage = {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      };

      let jsonContent = response.choices[0].message.content;
      jsonContent = jsonContent
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      let parsedResponse;
      try {
        parsedResponse = JSON.parse(jsonContent);
      } catch (error) {
        console.error("Failed to parse JSON response:", error);
        throw new Error("Invalid JSON response from API");
      }

      // Validate response structure
      if (
        !parsedResponse ||
        !Array.isArray(parsedResponse.tags) ||
        typeof parsedResponse.correspondent !== "string"
      ) {
        throw new Error(
          "Invalid response structure: missing tags array or correspondent string",
        );
      }

      return {
        document: parsedResponse,
        metrics: mappedUsage,
        truncated: truncatedContent.length < content.length,
      };
    } catch (error) {
      console.error("Failed to analyze document:", error);
      return {
        document: { tags: [], correspondent: null },
        metrics: null,
        error: error.message,
      };
    }
  }

  /**
   * Generate text based on a prompt
   * @param {string} prompt - The prompt to generate text from
   * @returns {Promise<string>} - The generated text
   */
  async generateText(prompt) {
    try {
      this.initialize();

      if (!this.client) {
        throw new Error("OpenAI client not initialized - missing API key");
      }

      const model = process.env.OPENAI_MODEL || config.openai.model;

      const response = await this.client.chat.completions.create({
        model: model,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
      });

      if (!response?.choices?.[0]?.message?.content) {
        throw new Error("Invalid API response structure");
      }

      return response.choices[0].message.content;
    } catch (error) {
      console.error("Error generating text with OpenAI:", error);
      throw error;
    }
  }

  async checkStatus() {
    // send test request to OpenAI API and respond with 'ok' or 'error'
    try {
      this.initialize();

      if (!this.client) {
        throw new Error("OpenAI client not initialized - missing API key");
      }
      const response = await this.client.chat.completions.create({
        model: process.env.OPENAI_MODEL,
        messages: [
          {
            role: "user",
            content: "Test",
          },
        ],
        temperature: 0.7,
      });
      if (!response?.choices?.[0]?.message?.content) {
        throw new Error("Invalid API response structure");
      }
      return { status: "ok", model: process.env.OPENAI_MODEL };
    } catch (error) {
      console.error("Error checking OpenAI status:", error);
      return { status: "error", error: error.message };
    }
  }
}

module.exports = new OpenAIService();

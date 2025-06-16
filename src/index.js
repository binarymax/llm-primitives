import fs from 'fs';
import ejs from 'ejs';
import path from 'path';
import OpenAI from 'openai';
import completions from './completions.js';
const Completions = new completions();

const enum_schema = function(options) {
  return {
    "name": "choice",
    "description": "Choose the best option based on the request.",
    "strict": true,
    "schema": {
      "type": "object",
      "properties": {
        "option": {
          "type": "string",
          "enum": options
        }
      },
      "required":["option"],
      "additionalProperties":false
    }
  }
}

const bool_schema = function() {
  return {
    "name": "boolean_value",
    "description": "Answer true or false based on the request.",
    "strict": true,
    "schema": {
      "type": "object",
      "properties": {
        "answer": {
          "type": "boolean"
        }
      },
      "required":["answer"],
      "additionalProperties":false
    }
  }
}

const int_schema = function() {
  return {
    "name": "integer_value",
    "description": "Provide the answer to the request as an integer.",
    "strict": true,
    "schema": {
      "type": "object",
      "properties": {
        "answer": {
          "type": "integer"
        }
      },
      "required":["answer"],
      "additionalProperties":false
    }
  }
}

const float_schema = function() {
  return {
    "name": "float_value",
    "description": "Provide the answer to the request as a floating point number.",
    "strict": true,
    "schema": {
      "type": "object",
      "properties": {
        "answer": {
          "type": "number"
        }
      },
      "required":["answer"],
      "additionalProperties":false
    }
  }
}

const date_schema = function(date) {
  const today = date||(new Date()).toISOString().split('T')[0];
  return {
    "name": "date_value",
    "description": `Today's date is ${today}. Provide the answer to the request as an ISO 8601 date.`,
    "strict": true,
    "schema": {
      "type": "object",
      "properties": {
        "answer": {
          "type": "string",
          "description": "A valid ISO-8601 date"
        }
      },
      "required":["answer"],
      "additionalProperties":false
    }
  }
}


function OpenAICost(response) {
    const pricesPerMillion = {
        "o1-2024-12-17": { input: 15.00, output: 60.00 },
        "o1-mini-2024-09-12": { input: 1.10, output: 4.40 },
        "o3-mini-2025-01-31": { input: 1.10, output: 4.40 },
        "gpt-4.5-preview-2025-02-27": { input: 75.00, output: 150.00 },
        "gpt-4o": { input: 5.00, output: 15.00 },
        "gpt-4o-2024-08-06": { input: 2.50, output: 10.00 },
        "gpt-4o-2024-05-13": { input: 5.00, output: 15.00 },
        "gpt-4o-mini": { input: 0.15, output: 0.60 },
        "gpt-4o-mini-2024-07-18": { input: 0.15, output: 0.60 },
        "gpt-4-0613": { input: 30.00, output: 60.00 },
        "gpt-4-turbo-2024-04-09": { input: 10.00, output: 30.00 },
        "gpt-3.5-turbo": { input: 0.003, output: 0.006 },
        "gpt-4.1": { input: 2.00, output: 8.00 },
        "gpt-4.1-2025-04-14": { input: 2.00, output: 8.00 },
        "gpt-4.1-mini": { input: 0.40, output: 1.60 },
        "gpt-4.1-mini-2025-04-14": { input: 0.40, output: 1.60 },
        "gpt-4.1-nano": { input: 0.10, output: 0.40 },
        "gpt-4.1-nano-2025-04-14": { input: 0.10, output: 0.40 },
        "gpt-4o-audio-preview-2024-12-17": { input: 2.50, output: 10.00 },
        "gpt-4o-realtime-preview-2024-12-17": { input: 5.00, output: 20.00 },
        "gpt-4o-mini-audio-preview-2024-12-17": { input: 0.15, output: 0.60 },
        "gpt-4o-mini-realtime-preview-2024-12-17": { input: 0.60, output: 2.40 },
        "o1-pro-2025-03-19": { input: 150.00, output: 600.00 },
        "o3-pro-2025-06-10": { input: 20.00, output: 80.00 },
        "o3-2025-04-16": { input: 2.00, output: 8.00 },
        "o4-mini-2025-04-16": { input: 1.10, output: 4.40 },
        "codex-mini-latest": { input: 1.50, output: 6.00 },
        "gpt-4o-mini-search-preview-2025-03-11": { input: 0.15, output: 0.60 },
        "gpt-4o-search-preview-2025-03-11": { input: 2.50, output: 10.00 },
        "computer-use-preview-2025-03-11": { input: 3.00, output: 12.00 }
    };


    const modelVersion = response.model;
    if (!(modelVersion in pricesPerMillion)) {
        console.error(`Pricing information for model '${modelVersion}' is not available.`);
        return 0;
    }

    const inputPricePerMillion = pricesPerMillion[modelVersion].input;
    const outputPricePerMillion = pricesPerMillion[modelVersion].output;

    const promptTokens = response.usage.prompt_tokens;
    const completionTokens = response.usage.completion_tokens;

    const inputCost = (promptTokens / 1_000_000) * inputPricePerMillion;
    const outputCost = (completionTokens / 1_000_000) * outputPricePerMillion;
    return inputCost + outputCost;
}


//Gets the values from the OpenAI function call response message
const extractParams = function(response,name) {

  if (response) {
    const responseMessage = response.choices[0].message;
    if (responseMessage.function_call) {
      const functionName = responseMessage.function_call.name;
      if (functionName == name) {
        let functionArgs=null;
        try {
          functionArgs = JSON.parse(responseMessage.function_call.arguments);
        } catch (ex) {
          console.error(ex);
        }        
        return functionArgs;
      }
    }
  }

  //No valid response!
  return null;
}

//Gets the values from the OpenAI tool call response message
const extractToolParams = function(response,name) {

  if (response && response.choices && response.choices.length) {
    const responseMessage = response.choices[0].message;
    if (responseMessage.tool_calls && responseMessage.tool_calls.length) {
      const tools = responseMessage.tool_calls;
      for(var i=0;i<tools.length;i++) {
        if (tools[i]["function"]) {
          const fnresp = tools[i]["function"];
          if (fnresp.name == name) {
            let functionArgs = null;
            try {
              functionArgs = {"arguments":JSON.parse(fnresp.arguments)};
            } catch (ex) {
              console.error(ex);
            }
            return functionArgs;
          }
        }
      }
    } else if (responseMessage.content) {
      return responseMessage.content;
    }
  }

  //No valid response!
  return null;
}

//Gets the values from the OpenAI function call response message
const extractFunctionParams = function(response,name) {

  if (response && response.choices && response.choices.length) {
    const responseMessage = response.choices[0].message;
    if (responseMessage.function_call) {
      const functionName = responseMessage.function_call.name;
      if (functionName == name) {
        let functionArgs = null;
        try {
          functionArgs = JSON.parse(responseMessage.function_call.arguments);
        } catch (ex) {
          console.error(ex);
        }
        return functionArgs;
      }
    } else if (responseMessage.content) {
      return responseMessage.content;
    }
  }

  //No valid response!
  return null;
}

//Gets the values from the OpenAI function call response message
const extractStructuredResponse = function(response,name) {

  //console.log(name);
  //console.log(JSON.stringify(response,null,2));

  if (response && response.choices && response.choices.length) {
    const message = response.choices[0].message;
    if (message.content) {
      try {
        const json = JSON.parse(message.content);
        if(name) {
          return json[name];
        } else {
          return json;
        }

      } catch (ex) {
        console.error(ex);
      }
    } else if (responseMessage.content) {
      return responseMessage.content;
    }
  }

  //No valid response!
  return null;
}


//Gets the values from the OpenAI function call response message
const extractMessage = function(response) {

  try {
    if (response && response.choices && response.choices.length) {
      const message = response.choices[0].message;
      if(message.content) {
        return message.content;
      }
    }
  } catch(ex) {
    console.error(ex);
  }

  //No valid response!
  return null;
}

const template = function(filename,options) {
  options = options || {};
  const dir = path.dirname(filename);
  const str = fs.readFileSync(filename,'utf-8');
  options.views = options.views || [dir];
  options.filename = options.filename || filename;
  return ejs.compile(str,options);
}

//----------------------------------------

class LLM {

  constructor(options) {
    const apiKey = options.apiKey||process.env.OPENAI_API_KEY||null;
    this.model = options.model||defaultModel;
    this.system = options.system||"You are a helpful assistant.";
    this.developer = options.developer||"You are a helpful assistant.";
    this.userid = options.userid||"default";
    this.openai = new OpenAI({apiKey});

    // Register and Compile Prompt templates
    this.prompts = options.prompts||null;
    this.templates = {};
    if (this.prompts) {
      const templates = {};
      try {
        const files = fs.readdirSync(options.prompts);
        files.forEach(file => {
          const filename = path.join(options.prompts, file);
          if (fs.statSync(filename).isFile()) {
            const name = path.basename(file, path.extname(file)); // Remove extension
            templates[name] = template(filename);
          }
        });
        this.templates = templates;
        console.log('Templates loaded from:', this.prompts);
      } catch (err) {
        console.error('Error loading templates:', err);
      }
    }
  }

  render(name,data) {
    try {
      return this.templates[name](data);
    } catch(ex) {
      console.error(ex);
    }
    return null;
  }

  async _completion(content,json_schema,temperature,max_completion_tokens) {

    const self = this;
    temperature = temperature||0.0;
    try {

      let messages = [];
      if(self.system) messages.push({role: "system", content: self.system});
      messages.push({role: "user", content: content});

      const prompt = {
        model: self.model,
        messages: messages,
        temperature: temperature,
        stream: false,

      }

      if(json_schema) {
        //Structured output being requested
        prompt.response_format = {
          "type": "json_schema",
          "json_schema":json_schema
        };
      }

      if(max_completion_tokens) {
        //Crop
        prompt.max_completion_tokens = max_completion_tokens;
      }

      //Check if we have a cached response
      const cached = await Completions.findByPromptHash(self.model,prompt,self.userid);
      if(cached && cached.length && cached[0].response) {
        //Completion already generated and cached in database!
        return cached[0];
      }

      const start_time = Date.now();
      const response = await self.openai.chat.completions.create(prompt);
      const took = Date.now() - start_time; // Calculate the time delay of the last chunk

      //Cache the response
      const cost = OpenAICost(response);
      const completionid = await Completions.create(self.model, prompt, response, took, cost, self.userid);

      return {completionid,response,took,cost}

    } catch (error) {
      console.error(error);
    }

    return null;

  }

  // Provide a prompt as a yes/no question, and it will return true or false.
  // Used for general boolean questions, and things like "is this safe?"
  async bool(content,temperature) {
    const schema = bool_schema();
    const {response} = await this._completion(content,schema,temperature);
    return extractStructuredResponse(response,"answer");
  }

  // Provide a prompt and a list of options, and this will return one of the options
  // Used for classifications, for example "what industry type is this website?"
  async enum(content,options,temperature) {
    const schema = enum_schema(options);
    const {response} = await this._completion(content,schema,temperature);
    return extractStructuredResponse(response,"option");
  }

  // Provide a prompt that expects an integer output.
  async int(content,temperature) {
    const schema = int_schema();
    const {response} = await this._completion(content,schema,temperature);
    const answer = extractStructuredResponse(response,"answer");
    return parseInt(answer);
  }

  // Provide a prompt that expects a floating point output.
  async float(content,temperature) {
    const schema = float_schema();
    const {response} = await this._completion(content,schema,temperature);
    const answer = extractStructuredResponse(response,"answer");
    return parseFloat(answer);
  }


  // Provide a prompt that expects a date output.
  async date(content,date,temperature) {
    const schema = date_schema(date||null);
    const {response} = await this._completion(content,schema,temperature);
    const answer = extractStructuredResponse(response,"answer");
    return new Date(answer);
  }

  // Just a plain string completion, with an optional maximum token length
  async string(content,max_completion_tokens,temperature) {
    const {response} = await this._completion(content,null,temperature,max_completion_tokens);
    return extractMessage(response);
  }

  // A structured json response
  async json(content,schema,temperature) {
    const {response} = await this._completion(content,schema,temperature);
    return extractStructuredResponse(response);
  }

  //Streaming responses are only used for things like RAG or Chat
  async stream(content,send,temperature) {
    const self = this;
    temperature = temperature||0.0;
    try {

      let messages = [];
      if(self.system) messages.push({role: "system", content: self.system});
      messages.push({role: "user", content: content});
      
      const prompt = {
        model: self.model,
        messages: messages,
        temperature: temperature,
        stream: true,
        stream_options: {
          include_usage: true
        }
      }

      //Check if we have a cached response
      const cached = await Completions.findByPromptHash(self.model,prompt,self.userid);
      if(cached && cached.length && cached[0].response) {
        //Completion already generated and cached in database!
        send({"ready":true});
        const choices = cached[0].response.choices;
        choices.forEach(c=>send({"chunk":c.message?.content}));
        send({"done":true,"time":cached.took});
        return;
      }

      // Send the initiation response
      send({"ready":true});

      // Create variables to collect the stream of chunks
      let collectedMessages = [];
      let outputs = [];

      const start_time = Date.now();
      const stream = await self.openai.chat.completions.create(prompt);
      let response = null;
      for await (const chunk of stream) {
        const chunk_time = Date.now() - start_time; // Calculate the time delay of the chunk
        //console.debug(JSON.stringify(chunk));
        const chunk_message = chunk.choices[0]?.delta?.content || ''; // Extract the message
        const message = {"chunk":chunk_message,"time":chunk_time};
        collectedMessages.push(message);
        outputs.push(chunk_message);
        if(chunk.usage) response=JSON.parse(JSON.stringify(chunk));
        send(message);
      }

      const took = Date.now() - start_time; // Calculate the time delay of the last chunk
      const message = {"done":true,"time":took};
      collectedMessages.push(message);
      //console.debug(`Full response received ${took / 1000} seconds after request`);
      send(message);
      
      const output = outputs.join('');

      if(response && response.choices) {
        response.choices.push({
          "index": 0,
          "message": {
            "role": "assistant",
            "content": output,
          },
          "logprobs": null,
          "finish_reason": "stop"
        })
      }

      //Cache the response
      const cost = OpenAICost(response);
      const completionid = await Completions.create(self.model, prompt, response, took, cost, self.userid);

      return {completionid,response,output,took,cost}

    } catch (error) {
      console.error('Error:', error);
      send({"error":error});
    }

    return null;

  }

  // Get the cost summary grouped and filtered
  async costs(options) {
    return await Completions.costSummary(options);
  }

}

export default LLM;
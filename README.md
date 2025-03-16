# LLM Primitives

Basic software building blocks using LLMs.

Use LLMs to get things like Boolean, Enum selection, Int, Float, and Date responses.  And of course strings.

It also includes built in streaming, caching, and cost breakdowns grouped by arbitrary identifiers.

## Why does this exist?

Because when developing things like "agents" or when LLMs are part of complex workflows, sometimes we need the basics.  The most useful operation tend to be booleans and enum choice selection for branching logic, the others exist because they are also occasionally useful.

I have been using and evolving this library successfully since 2023 in production, and decided to open source it.  The original used Postgres for caching, this uses SQLite

_Note: This only works with OpenAI right now, and you need an API Key._

## How to use it

Install the module: 

```bash
npm install llm-primitives
```

Then import it (ESM only) and instantiate the llm class.

```javascript
import LLM from 'llm-primitives'

const llm = new LLM({
	apiKey:process.env.OPENAI_API_KEY,
	model:"gpt-4o-mini"
});
```

With the class, you can then use the methods in the examples below.  Each will return a properly casted object, or will return `null` and log an exception if there was a problem.

### bool

```javascript
const answer = await llm.bool("On a clear day, the sky is blue.");
//answer == true
```

### enum

```javascript
const options = ["blue","green","red"]
const answer = await llm.enum("On a clear day, the sky is the following color.",options);
//answer == 'blue'
```

### int

```javascript
const answer = await llm.int("What is 2+2?");
//answer == 4
```

### float

```javascript
const answer = await llm.float("What is Pi to the 5th decimal place?");
//answer==3.14159
```

### date

```javascript
const answer = await llm.date("When did Niel Armstrong walk on the moon?");
//answer==1969-07-20T00:00:00.000Z
```

### string

```javascript
const answer = await llm.string("In markdown, write a bulleted list of the four bending elements from Avatar: The Last Airbender.");
/*answer == `Sure! Here’s a bulleted list of the four bending elements from *Avatar: The Last Airbender*:

- Water
- Earth
- Fire
- Air`
*/
```

## Streaming

A handy `stream` method exists to handle all the details of calling the api, chunk processing, and caching.

Simply provide the prompt, and a `send` method.  The `send` method accepts one argument: message.

```javascript
const send = (message) => console.log(message);
llm.stream('My Amazing Prompt',send);
// => will stream chunk-by-chunk
```

The `message` object has the following possible forms:

 - `{"ready":true}` Indicates when the request is initialized, prepare to recieve chunks
 - `{"chunk":chunk_message,"time":chunk_time};` Is an individual chunked message from the API
 - `{"done":true,"time":took}` Indicates when the stream is complete, no further messages will be sent
 - `{"error":error}` Indicates an error occured, no further messages will be sent

## Prompt Rendering

llm-primitives also includes a handy prompt rendering tool.  It's common to mix pre-written prompts with data (such as RAG), and these methods make it easy to do so.

Prompts must use (EJS)[https://ejs.co/] template syntax.

First, when declaring instantiating a new LLM, register a directory 'prompts' which contains your EJS template files.

For example, suppose you have a directory `prompts` with two files:

```
./prompts
├── RAG.ejs
└── safety.ejs
```

Specify the prompts directory in your LLM instantiation options:

```javascript
const llm = new LLM({
	apiKey:process.env.OPENAI_API_KEY,
	model:"gpt-4o-mini",
	prompts:join(__dirname,"prompts")
});
```

Then, you can render a prompt just by using the name of the file, and pass in the data as the second param:

```javascript
llm.render('RAG',{"query":query,"hits":hits});
// => the fully rendered prompt ready to be used in llm.string or llm.stream
```



__Made with ❤️ by [Max Irwin](https://max.io)__
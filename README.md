# LLM Primitives

Basic software building blocks using LLMs.

Use LLMs to get things like Boolean, Enum selection, Int, Float, and Date responses.  And of course strings.

It also includes built in caching, cost breakdowns grouped by arbitrary identifiers, streaming, and regular completions.

## Why does this exist?

Because when developing things like "agents" or when LLMs are part of complex workflows, sometimes we need the basics.  The most useful operation tend to be booleans and enum choice selection for branching logic, the others exist because they are also occasionally useful.

I have been using and evolving this library internally since 2023 in production, and decided to open source it.

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

With the class, then use the methods like the examples below.  Each will return a properly casted object, or will return `null` and log an exception if there was a problem.

### bool

```javascript
    const answer = await llm.bool("On a clear day, the sky is blue.");
```

### enum

```javascript
    const options = ["blue","green","red"]
    const answer = await llm.enum("On a clear day, the sky is the following color.",options);
```

### int

```javascript
    const answer = await llm.int("What is 2+2?");
```

### float

```javascript
    const answer = await llm.float("What is Pi to the 5th decimal place?");
```

### string

```javascript
    const answer = await llm.string("In markdown, write a bulleted list of the four bending elements from 
```


__Made with ❤️ by (Max Irwin)[https://max.io]__
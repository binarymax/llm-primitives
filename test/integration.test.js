import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { strict as assert } from "assert";
import { config } from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, ".env") });

import LLM from "../src/index.js";

describe("Full integration test for llm-primitives", function () {

  const cachefile = join(__dirname,'..','cache.sqlite');
  console.log(cachefile);
  before(async function() {
    if (existsSync(cachefile)) {
      await unlink(cachefile);
    }
  });

  const llm = new LLM({
    apiKey:process.env.OPENAI_API_KEY,
    model:"gpt-4o-mini",
    prompts:join(__dirname,"prompts")
  });

  //
  // Test rendering
  //

  it("Should test template rendering", function () {
    const str = llm.render('prompt',{variable:"like this"});
    assert.equal(str,`# This is a Prompt

It's a pretty good prompt, too.

Because it has variables: like this

And includes Hello, World!`);

  });

  //
  // Below this line are fresh, uncached responses from OpenAI
  //  

  it("Should test bool", async function () {
    const answer = await llm.bool("On a clear day, the sky is blue.");
    assert.equal(answer, true);
  });

  it("Should test enum", async function () {    
    const options = ["blue","green","red"]
    const answer = await llm.enum("On a clear day, the sky is the following color.",options);
    assert.equal(answer, "blue");
  });

  it("Should test int", async function () {    
    const answer = await llm.int("What is 2+2?");
    assert.equal(answer, 4);
  });

  it("Should test float", async function () {    
    const answer = await llm.float("What is Pi to the 5th decimal place?");
    assert.equal(answer, 3.14159);
  });

  it("Should test date", async function () {    
    const answer = await llm.date("When did Niel Armstrong walk on the moon?");
    //answer==1969-07-20T00:00:00.000Z
    const expect = new Date('1969-07-20');
    assert.equal(answer.getTime(),expect.getTime());
  });

  it("Should test string", async function () {    
    const answer = await llm.string("In markdown, write a bulleted list of the four bending elements from Avatar: The Last Airbender.");
    const e = answer.toLowerCase().indexOf('earth')>0;
    const f = answer.toLowerCase().indexOf('fire')>0;
    const a = answer.toLowerCase().indexOf('air')>0;
    const w = answer.toLowerCase().indexOf('water')>0;
    assert.equal(e,true);
    assert.equal(f,true);
    assert.equal(a,true);
    assert.equal(w,true);
  });

  it("Should test cached streaming function", async function () {
    let hasReady = false;
    let hasChunk = false;
    let hasError = false;
    let hasDone = false;
    const send = function(message) {
      if(message.ready) hasReady = true;
      if(message.chunk) hasChunk = true;
      if(message.error) hasError = true;
      if(message.done) hasDone = true;
    }
    const completed = await llm.stream("How much wood could a woodchuck chuck if a woodchuck could chuck wood?",send);
    assert.equal(hasReady,true);
    assert.equal(hasChunk,true);
    assert.equal(hasError,false);
    assert.equal(hasDone,true);
  }); 

  //
  // Below this line are CACHED responses!
  //

  it("Should test cached bool", async function () {
    const answer = await llm.bool("On a clear day, the sky is blue.");
    assert.equal(answer, true);
  });

  it("Should test cached enum", async function () {    
    const options = ["blue","green","red"]
    const answer = await llm.enum("On a clear day, the sky is the following color.",options);
    assert.equal(answer, "blue");
  });

  it("Should test cached int", async function () {    
    const answer = await llm.int("What is 2+2?");
    assert.equal(answer, 4);
  });

  it("Should test cached float", async function () {    
    const answer = await llm.float("What is Pi to the 5th decimal place?");
    assert.equal(answer, 3.14159);
  });

  it("Should test cached string", async function () {    
    const answer = await llm.string("In markdown, write a bulleted list of the four bending elements from Avatar: The Last Airbender.");
    const e = answer.toLowerCase().indexOf('earth')>0;
    const f = answer.toLowerCase().indexOf('fire')>0;
    const a = answer.toLowerCase().indexOf('air')>0;
    const w = answer.toLowerCase().indexOf('water')>0;
    assert.equal(e,true);
    assert.equal(f,true);
    assert.equal(a,true);
    assert.equal(w,true);
  });

  it("Should test cached streaming function", async function () {
    let hasReady = false;
    let hasChunk = false;
    let hasError = false;
    let hasDone = false;
    const send = function(message) {
      if(message.ready) hasReady = true;
      if(message.chunk) hasChunk = true;
      if(message.error) hasError = true;
      if(message.done) hasDone = true;
    }
    const completed = await llm.stream("How much wood could a woodchuck chuck if a woodchuck could chuck wood?",send);
    assert.equal(hasReady,true);
    assert.equal(hasChunk,true);
    assert.equal(hasError,false);
    assert.equal(hasDone,true);
  });

});

import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { strict as assert } from "assert";
import { config } from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, ".env") });

import LLM from "../src/index.js";

describe("Test primitive values, without cache", function () {

  const cachefile = join(__dirname,'..','cache.sqlite');
  console.log(cachefile);
  before(async function() {
    if (existsSync(cachefile)) {
      await unlink(cachefile);
    }
  });

  const llm = new LLM({
    apiKey:process.env.OPENAI_API_KEY,
    model:"gpt-4o-mini"
  });

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

});

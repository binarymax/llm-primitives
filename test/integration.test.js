import { strict as assert } from "assert";
import { config } from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, ".env") });

import LLM from "../src/index.js";

describe("Test primitive values", function () {

  const llm = new LLM({
    apiKey:process.env.OPENAI_API_KEY,
    model:"gpt-4o"
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


});

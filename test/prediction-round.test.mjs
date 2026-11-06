import test from "node:test";
import assert from "node:assert/strict";
import { makePredictionKey, predictionHit } from "../public/chat/prediction-round.mjs";

test("different rooms never share predictions", () => assert.notEqual(makePredictionKey("ABCDE",1,12345),makePredictionKey("FGHIJ",1,12345)));
test("rematches never reuse the same prediction key", () => assert.notEqual(makePredictionKey("ABCDE",1,12345),makePredictionKey("ABCDE",1,67890)));
test("room normalization and invalid round identities", () => {assert.equal(makePredictionKey(" abcde ",1,12345),"room:ABCDE:round:1:deadline:12345");assert.equal(makePredictionKey("",1,12345),null);assert.equal(makePredictionKey("ABCDE",0,12345),null);assert.equal(makePredictionKey("ABCDE",1,null),null)});
test("tie counts as a top answer, but minority does not", () => {assert.equal(predictionHit([2,2,1],1),true);assert.equal(predictionHit([2,2,1],2),false)});
test("no answers cannot produce a fake hit", () => assert.equal(predictionHit([0,0,0],0),false));
test("invalid votes and selections fail closed", () => {assert.equal(predictionHit([1,-1],0),false);assert.equal(predictionHit([1,2],2),false);assert.equal(predictionHit([],0),false)});

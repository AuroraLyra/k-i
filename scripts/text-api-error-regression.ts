import assert from 'node:assert/strict';
import { classifyTextApiHttpError, isNonRetryableTextApiError, TextApiRequestError } from '../src/utils/textApiErrors.ts';

const geminiBlocked = classifyTextApiHttpError(400, JSON.stringify({
  error: {
    message: 'request blocked by Gemini API: PROHIBITED_CONTENT',
    type: 'prompt_blocked',
    param: '',
    code: 'prompt_blocked'
  }
}));
assert.equal(geminiBlocked.category, 'content-blocked');
assert.equal(geminiBlocked.retryable, false);
assert.equal(geminiBlocked.responseFormatUnsupported, false);
assert.equal(isNonRetryableTextApiError(new TextApiRequestError('blocked', geminiBlocked)), true);

const unsupportedFormat = classifyTextApiHttpError(400, JSON.stringify({
  error: {
    message: "Invalid parameter: response_format json_object is not supported with this model.",
    type: 'invalid_request_error',
    code: 'unsupported_parameter',
    param: 'response_format'
  }
}));
assert.equal(unsupportedFormat.category, 'response-format-unsupported');
assert.equal(unsupportedFormat.responseFormatUnsupported, true);
assert.equal(unsupportedFormat.retryable, false);

const unrelatedBadRequest = classifyTextApiHttpError(400, JSON.stringify({ error: { message: 'Input is too long.' } }));
assert.equal(unrelatedBadRequest.category, 'invalid-request');
assert.equal(unrelatedBadRequest.responseFormatUnsupported, false);
assert.equal(unrelatedBadRequest.retryable, false);

assert.equal(classifyTextApiHttpError(429, '').retryable, true);
assert.equal(classifyTextApiHttpError(503, '').retryable, true);
assert.equal(classifyTextApiHttpError(401, '').retryable, false);

console.log('Text API error regression checks passed.');
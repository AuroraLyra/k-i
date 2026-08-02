import assert from 'node:assert/strict';
import { createJsonSchemaValidator } from '../src/utils/jsonSchema';

const validateCalendarArguments = createJsonSchemaValidator({
  type: 'object',
  additionalProperties: false,
  required: ['title', 'durationMinutes'],
  properties: {
    title: { type: 'string', minLength: 1 },
    durationMinutes: { type: 'integer', minimum: 15, maximum: 240 },
    category: { enum: ['date', 'travel'] },
    attendees: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
      uniqueItems: true
    },
    location: { $ref: '#/$defs/location' }
  },
  $defs: {
    location: {
      type: 'object',
      required: ['latitude', 'longitude'],
      properties: {
        latitude: { type: 'number', minimum: -90, maximum: 90 },
        longitude: { type: 'number', minimum: -180, maximum: 180 }
      }
    }
  }
});

assert.deepEqual(validateCalendarArguments({
  title: '周末约会',
  durationMinutes: 120,
  category: 'date',
  attendees: ['测试员'],
  location: { latitude: 31.2304, longitude: 121.4737 }
}), []);

const invalidArguments = validateCalendarArguments({
  durationMinutes: 10,
  category: 'work',
  attendees: ['测试员', '测试员'],
  unexpected: true
});
assert.equal(invalidArguments.length, 3);
assert.match(invalidArguments[0]!, /\/title 必填/);
assert.match(invalidArguments.join('；'), /durationMinutes/);
assert.match(invalidArguments.join('；'), /category/);

const validateConditionalValue = createJsonSchemaValidator({
  if: { properties: { mode: { const: 'email' } } },
  then: { required: ['email'] },
  else: { required: ['phone'] }
});
assert.deepEqual(validateConditionalValue({ mode: 'email', email: 'tester@example.com' }), []);
assert.match(validateConditionalValue({ mode: 'email' }).join('；'), /email/);
assert.match(validateConditionalValue({ mode: 'sms' }).join('；'), /phone/);

assert.throws(() => createJsonSchemaValidator({ $ref: 'https://example.com/schema.json' }), /不支持外部 JSON Schema 引用/);
assert.throws(() => createJsonSchemaValidator({ type: 'missing-type' }), /有效 JSON 类型/);

console.log('MCP schema regression checks passed.');
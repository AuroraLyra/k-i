type JsonSchema = boolean | Record<string, unknown>;

const jsonTypes = new Set(['array', 'boolean', 'integer', 'null', 'number', 'object', 'string']);
const maxValidationDepth = 64;
const maxValidationErrors = 3;

export type JsonSchemaValidator = (value: unknown) => string[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOwnProperty(value: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function joinJsonPointer(path: string, key: string | number) {
  const escapedKey = String(key).replace(/~/g, '~0').replace(/\//g, '~1');
  return `${path}/${escapedKey}`;
}

function formatSchemaPath(path: string, keyword: string) {
  return `${path}/${keyword}`;
}

function isJsonEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => isJsonEqual(item, right[index]));
  }
  if (!isRecord(left) || !isRecord(right)) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key) => hasOwnProperty(right, key) && isJsonEqual(left[key], right[key]));
}

class JsonSchemaInterpreter {
  constructor(private readonly rootSchema: unknown) {}

  createValidator(): JsonSchemaValidator {
    this.assertSchema(this.rootSchema, '#', new WeakSet());
    return (value) => this.validate(this.rootSchema as JsonSchema, value, '', 0).slice(0, maxValidationErrors);
  }

  private assertSchema(schema: unknown, path: string, seenSchemas: WeakSet<Record<string, unknown>>): asserts schema is JsonSchema {
    if (typeof schema === 'boolean') return;
    if (!isRecord(schema)) throw new Error(`${path} 必须是 JSON Schema 对象或布尔值。`);
    if (seenSchemas.has(schema)) return;
    seenSchemas.add(schema);

    this.assertType(schema, path);
    this.assertBoolean(schema, 'nullable', path);
    this.assertArray(schema, 'enum', path);
    this.assertString(schema, '$ref', path);
    this.assertSchemaArray(schema, 'allOf', path, seenSchemas, true);
    this.assertSchemaArray(schema, 'anyOf', path, seenSchemas, true);
    this.assertSchemaArray(schema, 'oneOf', path, seenSchemas, true);
    this.assertSchemaValue(schema, 'not', path, seenSchemas);
    this.assertSchemaValue(schema, 'if', path, seenSchemas);
    this.assertSchemaValue(schema, 'then', path, seenSchemas);
    this.assertSchemaValue(schema, 'else', path, seenSchemas);
    this.assertSchemaMap(schema, '$defs', path, seenSchemas);
    this.assertSchemaMap(schema, 'definitions', path, seenSchemas);
    this.assertSchemaMap(schema, 'properties', path, seenSchemas);
    this.assertSchemaMap(schema, 'patternProperties', path, seenSchemas);
    this.assertPatternMap(schema, path);
    this.assertSchemaMap(schema, 'dependentSchemas', path, seenSchemas);
    this.assertStringArray(schema, 'required', path);
    this.assertStringArrayMap(schema, 'dependentRequired', path);
    this.assertDependencies(schema, path, seenSchemas);
    this.assertSchemaValue(schema, 'additionalProperties', path, seenSchemas, true);
    this.assertSchemaValue(schema, 'propertyNames', path, seenSchemas);
    this.assertNonNegativeInteger(schema, 'minProperties', path);
    this.assertNonNegativeInteger(schema, 'maxProperties', path);
    this.assertSchemaArray(schema, 'prefixItems', path, seenSchemas);
    this.assertItems(schema, path, seenSchemas);
    this.assertSchemaValue(schema, 'additionalItems', path, seenSchemas, true);
    this.assertSchemaValue(schema, 'contains', path, seenSchemas);
    this.assertNonNegativeInteger(schema, 'minItems', path);
    this.assertNonNegativeInteger(schema, 'maxItems', path);
    this.assertNonNegativeInteger(schema, 'minContains', path);
    this.assertNonNegativeInteger(schema, 'maxContains', path);
    this.assertBoolean(schema, 'uniqueItems', path);
    this.assertNonNegativeInteger(schema, 'minLength', path);
    this.assertNonNegativeInteger(schema, 'maxLength', path);
    this.assertPattern(schema, path);
    this.assertNumber(schema, 'minimum', path);
    this.assertNumber(schema, 'maximum', path);
    this.assertExclusiveBound(schema, 'exclusiveMinimum', path);
    this.assertExclusiveBound(schema, 'exclusiveMaximum', path);
    this.assertPositiveNumber(schema, 'multipleOf', path);

    if (hasOwnProperty(schema, '$ref')) this.resolveReference(schema.$ref);
  }

  private assertType(schema: Record<string, unknown>, path: string) {
    if (!hasOwnProperty(schema, 'type')) return;
    const type = schema.type;
    const validType = (candidate: unknown) => typeof candidate === 'string' && jsonTypes.has(candidate);
    if (validType(type)) return;
    if (Array.isArray(type) && type.length > 0 && type.every(validType)) return;
    throw new Error(`${formatSchemaPath(path, 'type')} 必须是有效 JSON 类型或类型数组。`);
  }

  private assertString(schema: Record<string, unknown>, keyword: string, path: string) {
    if (hasOwnProperty(schema, keyword) && typeof schema[keyword] !== 'string') {
      throw new Error(`${formatSchemaPath(path, keyword)} 必须是字符串。`);
    }
  }

  private assertBoolean(schema: Record<string, unknown>, keyword: string, path: string) {
    if (hasOwnProperty(schema, keyword) && typeof schema[keyword] !== 'boolean') {
      throw new Error(`${formatSchemaPath(path, keyword)} 必须是布尔值。`);
    }
  }

  private assertArray(schema: Record<string, unknown>, keyword: string, path: string) {
    if (hasOwnProperty(schema, keyword) && !Array.isArray(schema[keyword])) {
      throw new Error(`${formatSchemaPath(path, keyword)} 必须是数组。`);
    }
  }

  private assertStringArray(schema: Record<string, unknown>, keyword: string, path: string) {
    if (!hasOwnProperty(schema, keyword)) return;
    const values = schema[keyword];
    if (!Array.isArray(values) || !values.every((value) => typeof value === 'string')) {
      throw new Error(`${formatSchemaPath(path, keyword)} 必须是字符串数组。`);
    }
  }

  private assertStringArrayMap(schema: Record<string, unknown>, keyword: string, path: string) {
    if (!hasOwnProperty(schema, keyword)) return;
    const map = schema[keyword];
    if (!isRecord(map)) throw new Error(`${formatSchemaPath(path, keyword)} 必须是对象。`);
    for (const [key, values] of Object.entries(map)) {
      if (!Array.isArray(values) || !values.every((value) => typeof value === 'string')) {
        throw new Error(`${formatSchemaPath(path, keyword)}/${key} 必须是字符串数组。`);
      }
    }
  }

  private assertSchemaValue(schema: Record<string, unknown>, keyword: string, path: string, seenSchemas: WeakSet<Record<string, unknown>>, allowBoolean = false) {
    if (!hasOwnProperty(schema, keyword)) return;
    const value = schema[keyword];
    if (allowBoolean && typeof value === 'boolean') return;
    this.assertSchema(value, formatSchemaPath(path, keyword), seenSchemas);
  }

  private assertSchemaArray(schema: Record<string, unknown>, keyword: string, path: string, seenSchemas: WeakSet<Record<string, unknown>>, nonEmpty = false) {
    if (!hasOwnProperty(schema, keyword)) return;
    const schemas = schema[keyword];
    if (!Array.isArray(schemas) || (nonEmpty && schemas.length === 0)) {
      throw new Error(`${formatSchemaPath(path, keyword)} 必须是${nonEmpty ? '非空' : ''}规则数组。`);
    }
    schemas.forEach((nestedSchema, index) => this.assertSchema(nestedSchema, joinJsonPointer(formatSchemaPath(path, keyword), index), seenSchemas));
  }

  private assertSchemaMap(schema: Record<string, unknown>, keyword: string, path: string, seenSchemas: WeakSet<Record<string, unknown>>) {
    if (!hasOwnProperty(schema, keyword)) return;
    const schemaMap = schema[keyword];
    if (!isRecord(schemaMap)) throw new Error(`${formatSchemaPath(path, keyword)} 必须是对象。`);
    Object.entries(schemaMap).forEach(([key, nestedSchema]) => this.assertSchema(nestedSchema, joinJsonPointer(formatSchemaPath(path, keyword), key), seenSchemas));
  }

  private assertPatternMap(schema: Record<string, unknown>, path: string) {
    if (!isRecord(schema.patternProperties)) return;
    for (const pattern of Object.keys(schema.patternProperties)) {
      try {
        new RegExp(pattern);
      } catch {
        throw new Error(`${formatSchemaPath(path, 'patternProperties')}/${pattern} 不是有效正则表达式。`);
      }
    }
  }

  private assertDependencies(schema: Record<string, unknown>, path: string, seenSchemas: WeakSet<Record<string, unknown>>) {
    if (!hasOwnProperty(schema, 'dependencies')) return;
    const dependencies = schema.dependencies;
    if (!isRecord(dependencies)) throw new Error(`${formatSchemaPath(path, 'dependencies')} 必须是对象。`);
    for (const [key, dependency] of Object.entries(dependencies)) {
      if (Array.isArray(dependency)) {
        if (!dependency.every((value) => typeof value === 'string')) {
          throw new Error(`${formatSchemaPath(path, 'dependencies')}/${key} 必须是字符串数组或规则。`);
        }
      } else {
        this.assertSchema(dependency, joinJsonPointer(formatSchemaPath(path, 'dependencies'), key), seenSchemas);
      }
    }
  }

  private assertItems(schema: Record<string, unknown>, path: string, seenSchemas: WeakSet<Record<string, unknown>>) {
    if (!hasOwnProperty(schema, 'items')) return;
    const items = schema.items;
    if (Array.isArray(items)) {
      items.forEach((nestedSchema, index) => this.assertSchema(nestedSchema, joinJsonPointer(formatSchemaPath(path, 'items'), index), seenSchemas));
      return;
    }
    this.assertSchema(items, formatSchemaPath(path, 'items'), seenSchemas);
  }

  private assertNonNegativeInteger(schema: Record<string, unknown>, keyword: string, path: string) {
    if (!hasOwnProperty(schema, keyword)) return;
    const value = schema[keyword];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      throw new Error(`${formatSchemaPath(path, keyword)} 必须是非负整数。`);
    }
  }

  private assertNumber(schema: Record<string, unknown>, keyword: string, path: string) {
    if (!hasOwnProperty(schema, keyword)) return;
    const value = schema[keyword];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`${formatSchemaPath(path, keyword)} 必须是有限数字。`);
    }
  }

  private assertPositiveNumber(schema: Record<string, unknown>, keyword: string, path: string) {
    if (!hasOwnProperty(schema, keyword)) return;
    const value = schema[keyword];
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      throw new Error(`${formatSchemaPath(path, keyword)} 必须是正数。`);
    }
  }

  private assertExclusiveBound(schema: Record<string, unknown>, keyword: string, path: string) {
    if (!hasOwnProperty(schema, keyword)) return;
    const value = schema[keyword];
    if (typeof value === 'boolean') return;
    this.assertNumber(schema, keyword, path);
  }

  private assertPattern(schema: Record<string, unknown>, path: string) {
    if (!hasOwnProperty(schema, 'pattern')) return;
    const pattern = schema.pattern;
    if (typeof pattern !== 'string') throw new Error(`${formatSchemaPath(path, 'pattern')} 必须是字符串。`);
    try {
      new RegExp(pattern);
    } catch {
      throw new Error(`${formatSchemaPath(path, 'pattern')} 不是有效正则表达式。`);
    }
  }

  private validate(schema: JsonSchema, value: unknown, path: string, depth: number): string[] {
    if (depth > maxValidationDepth) return [`${path || '参数'} 嵌套层级过深`];
    if (typeof schema === 'boolean') return schema ? [] : [`${path || '参数'} 不符合禁止规则`];

    const errors: string[] = [];
    if (typeof schema.$ref === 'string') errors.push(...this.validate(this.resolveReference(schema.$ref), value, path, depth + 1));
    if (hasOwnProperty(schema, 'const') && !isJsonEqual(value, schema.const)) errors.push(`${path || '参数'} 必须等于指定值`);
    if (Array.isArray(schema.enum) && !schema.enum.some((candidate) => isJsonEqual(value, candidate))) errors.push(`${path || '参数'} 不在允许值中`);

    const allowedTypes = this.getTypes(schema);
    if (allowedTypes.length > 0 && !allowedTypes.some((type) => this.matchesType(type, value))) {
      errors.push(`${path || '参数'} 必须是 ${allowedTypes.join(' 或 ')} 类型`);
      return errors;
    }

    if (Array.isArray(schema.allOf)) {
      for (const nestedSchema of schema.allOf) errors.push(...this.validate(nestedSchema as JsonSchema, value, path, depth + 1));
    }
    if (Array.isArray(schema.anyOf) && !schema.anyOf.some((nestedSchema) => this.validate(nestedSchema as JsonSchema, value, path, depth + 1).length === 0)) {
      errors.push(`${path || '参数'} 不符合任一候选规则`);
    }
    if (Array.isArray(schema.oneOf)) {
      const matchCount = schema.oneOf.filter((nestedSchema) => this.validate(nestedSchema as JsonSchema, value, path, depth + 1).length === 0).length;
      if (matchCount !== 1) errors.push(`${path || '参数'} 必须恰好符合一个候选规则`);
    }
    if (schema.not !== undefined && this.validate(schema.not as JsonSchema, value, path, depth + 1).length === 0) {
      errors.push(`${path || '参数'} 不得符合禁止规则`);
    }
    if (schema.if !== undefined) {
      const branch = this.validate(schema.if as JsonSchema, value, path, depth + 1).length === 0 ? schema.then : schema.else;
      if (branch !== undefined) errors.push(...this.validate(branch as JsonSchema, value, path, depth + 1));
    }

    if (isRecord(value)) errors.push(...this.validateObject(schema, value, path, depth));
    if (Array.isArray(value)) errors.push(...this.validateArray(schema, value, path, depth));
    if (typeof value === 'string') errors.push(...this.validateString(schema, value, path));
    if (typeof value === 'number') errors.push(...this.validateNumber(schema, value, path));
    return errors;
  }

  private getTypes(schema: Record<string, unknown>) {
    const declaredType = schema.type;
    const types = typeof declaredType === 'string'
      ? [declaredType]
      : Array.isArray(declaredType) ? declaredType.filter((type): type is string => typeof type === 'string') : [];
    return schema.nullable === true && !types.includes('null') ? [...types, 'null'] : types;
  }

  private matchesType(type: string, value: unknown) {
    if (type === 'array') return Array.isArray(value);
    if (type === 'boolean') return typeof value === 'boolean';
    if (type === 'integer') return typeof value === 'number' && Number.isInteger(value);
    if (type === 'null') return value === null;
    if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
    if (type === 'object') return isRecord(value);
    return type === 'string' && typeof value === 'string';
  }

  private validateObject(schema: Record<string, unknown>, value: Record<string, unknown>, path: string, depth: number) {
    const errors: string[] = [];
    const required = Array.isArray(schema.required) ? schema.required.filter((key): key is string => typeof key === 'string') : [];
    for (const key of required) {
      if (!hasOwnProperty(value, key)) errors.push(`${joinJsonPointer(path, key)} 必填`);
    }
    if (typeof schema.minProperties === 'number' && Object.keys(value).length < schema.minProperties) errors.push(`${path || '参数'} 属性数量不足`);
    if (typeof schema.maxProperties === 'number' && Object.keys(value).length > schema.maxProperties) errors.push(`${path || '参数'} 属性数量超限`);

    const properties = isRecord(schema.properties) ? schema.properties : {};
    const patternProperties = isRecord(schema.patternProperties) ? schema.patternProperties : {};
    const patterns = Object.entries(patternProperties).map(([pattern, nestedSchema]) => ({ pattern: new RegExp(pattern), nestedSchema: nestedSchema as JsonSchema }));
    for (const [key, propertyValue] of Object.entries(value)) {
      const propertyPath = joinJsonPointer(path, key);
      if (hasOwnProperty(properties, key)) errors.push(...this.validate(properties[key] as JsonSchema, propertyValue, propertyPath, depth + 1));
      const matchingPatterns = patterns.filter(({ pattern }) => pattern.test(key));
      for (const { nestedSchema } of matchingPatterns) errors.push(...this.validate(nestedSchema, propertyValue, propertyPath, depth + 1));
      if (!hasOwnProperty(properties, key) && matchingPatterns.length === 0) {
        if (schema.additionalProperties === false) errors.push(`${propertyPath} 不允许额外属性`);
        if (isRecord(schema.additionalProperties) || schema.additionalProperties === true) {
          errors.push(...this.validate(schema.additionalProperties as JsonSchema, propertyValue, propertyPath, depth + 1));
        }
      }
      if (schema.propertyNames !== undefined) errors.push(...this.validate(schema.propertyNames as JsonSchema, key, propertyPath, depth + 1));
    }

    const dependentRequired = isRecord(schema.dependentRequired) ? schema.dependentRequired : {};
    for (const [key, dependencies] of Object.entries(dependentRequired)) {
      if (!hasOwnProperty(value, key) || !Array.isArray(dependencies)) continue;
      for (const dependency of dependencies) {
        if (typeof dependency === 'string' && !hasOwnProperty(value, dependency)) errors.push(`${joinJsonPointer(path, dependency)} 在提供 ${key} 时必填`);
      }
    }
    const dependencies = isRecord(schema.dependencies) ? schema.dependencies : {};
    for (const [key, dependency] of Object.entries(dependencies)) {
      if (!hasOwnProperty(value, key)) continue;
      if (Array.isArray(dependency)) {
        for (const propertyName of dependency) {
          if (typeof propertyName === 'string' && !hasOwnProperty(value, propertyName)) errors.push(`${joinJsonPointer(path, propertyName)} 在提供 ${key} 时必填`);
        }
      } else {
        errors.push(...this.validate(dependency as JsonSchema, value, path, depth + 1));
      }
    }
    if (isRecord(schema.dependentSchemas)) {
      for (const [key, dependency] of Object.entries(schema.dependentSchemas)) {
        if (hasOwnProperty(value, key)) errors.push(...this.validate(dependency as JsonSchema, value, path, depth + 1));
      }
    }
    return errors;
  }

  private validateArray(schema: Record<string, unknown>, value: unknown[], path: string, depth: number) {
    const errors: string[] = [];
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) errors.push(`${path || '参数'} 元素数量不足`);
    if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) errors.push(`${path || '参数'} 元素数量超限`);
    if (schema.uniqueItems === true) {
      for (let index = 0; index < value.length; index += 1) {
        if (value.slice(index + 1).some((candidate) => isJsonEqual(candidate, value[index]))) {
          errors.push(`${path || '参数'} 不能包含重复元素`);
          break;
        }
      }
    }

    const prefixItems = Array.isArray(schema.prefixItems) ? schema.prefixItems : [];
    prefixItems.forEach((nestedSchema, index) => {
      if (index < value.length) errors.push(...this.validate(nestedSchema as JsonSchema, value[index], joinJsonPointer(path, index), depth + 1));
    });
    const itemSchemas = schema.items;
    if (Array.isArray(itemSchemas)) {
      itemSchemas.forEach((nestedSchema, index) => {
        if (index < value.length) errors.push(...this.validate(nestedSchema as JsonSchema, value[index], joinJsonPointer(path, index), depth + 1));
      });
      if (schema.additionalItems !== undefined) {
        value.slice(itemSchemas.length).forEach((item, index) => errors.push(...this.validate(schema.additionalItems as JsonSchema, item, joinJsonPointer(path, itemSchemas.length + index), depth + 1)));
      }
    } else if (itemSchemas !== undefined) {
      value.slice(prefixItems.length).forEach((item, index) => errors.push(...this.validate(itemSchemas as JsonSchema, item, joinJsonPointer(path, prefixItems.length + index), depth + 1)));
    }
    if (schema.contains !== undefined) {
      const matchingItems = value.filter((item) => this.validate(schema.contains as JsonSchema, item, path, depth + 1).length === 0).length;
      const minimum = typeof schema.minContains === 'number' ? schema.minContains : 1;
      const maximum = typeof schema.maxContains === 'number' ? schema.maxContains : Infinity;
      if (matchingItems < minimum || matchingItems > maximum) errors.push(`${path || '参数'} 包含的匹配元素数量不符合要求`);
    }
    return errors;
  }

  private validateString(schema: Record<string, unknown>, value: string, path: string) {
    const errors: string[] = [];
    const length = Array.from(value).length;
    if (typeof schema.minLength === 'number' && length < schema.minLength) errors.push(`${path || '参数'} 长度不足`);
    if (typeof schema.maxLength === 'number' && length > schema.maxLength) errors.push(`${path || '参数'} 长度超限`);
    if (typeof schema.pattern === 'string' && !new RegExp(schema.pattern).test(value)) errors.push(`${path || '参数'} 不匹配指定格式`);
    return errors;
  }

  private validateNumber(schema: Record<string, unknown>, value: number, path: string) {
    const errors: string[] = [];
    const minimum = typeof schema.minimum === 'number' ? schema.minimum : undefined;
    const maximum = typeof schema.maximum === 'number' ? schema.maximum : undefined;
    const exclusiveMinimum = schema.exclusiveMinimum;
    const exclusiveMaximum = schema.exclusiveMaximum;
    if (minimum !== undefined && (exclusiveMinimum === true ? value <= minimum : value < minimum)) errors.push(`${path || '参数'} 不能小于${exclusiveMinimum === true ? '或等于' : ''}最小值`);
    if (maximum !== undefined && (exclusiveMaximum === true ? value >= maximum : value > maximum)) errors.push(`${path || '参数'} 不能大于${exclusiveMaximum === true ? '或等于' : ''}最大值`);
    if (typeof exclusiveMinimum === 'number' && value <= exclusiveMinimum) errors.push(`${path || '参数'} 必须大于最小值`);
    if (typeof exclusiveMaximum === 'number' && value >= exclusiveMaximum) errors.push(`${path || '参数'} 必须小于最大值`);
    if (typeof schema.multipleOf === 'number') {
      const quotient = value / schema.multipleOf;
      if (Math.abs(quotient - Math.round(quotient)) > Number.EPSILON * Math.max(1, Math.abs(quotient))) errors.push(`${path || '参数'} 必须是指定数值的倍数`);
    }
    return errors;
  }

  private resolveReference(reference: unknown): JsonSchema {
    if (typeof reference !== 'string') throw new Error('$ref 必须是字符串。');
    if (reference === '#') return this.rootSchema as JsonSchema;
    if (!reference.startsWith('#/')) throw new Error(`不支持外部 JSON Schema 引用：${reference}`);
    let currentValue: unknown = this.rootSchema;
    for (const encodedSegment of reference.slice(2).split('/')) {
      const segment = encodedSegment.replace(/~1/g, '/').replace(/~0/g, '~');
      if (Array.isArray(currentValue)) currentValue = currentValue[Number(segment)];
      else if (isRecord(currentValue)) currentValue = currentValue[segment];
      else currentValue = undefined;
      if (currentValue === undefined) throw new Error(`找不到 JSON Schema 引用：${reference}`);
    }
    if (typeof currentValue === 'boolean' || isRecord(currentValue)) return currentValue;
    throw new Error(`JSON Schema 引用不是有效规则：${reference}`);
  }
}

export function createJsonSchemaValidator(schema: unknown): JsonSchemaValidator {
  return new JsonSchemaInterpreter(schema).createValidator();
}
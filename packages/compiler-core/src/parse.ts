import { extend, NO } from "@vue/shared";
import { ConstantTypes, ElementTypes, Namespaces, NodeTypes } from "./ast";
import { advancePositionWithClone, advancePositionWithMutation } from "./utils";

export const enum TextModes {
  //          | Elements | Entities | End sign              | Inside of
  DATA, //    | ✔        | ✔        | End tags of ancestors |
  RCDATA, //  | ✘        | ✔        | End tag of the parent | <textarea>
  RAWTEXT, // | ✘        | ✘        | End tag of the parent | <style>,<script>
  CDATA,
  ATTRIBUTE_VALUE,
}

const enum TagType {
  Start,
  End,
}

// The default decoder only provides escapes for characters reserved as part of
// the template syntax, and is only used if the custom renderer did not provide
// a platform-specific decoder.
const decodeRE = /&(gt|lt|amp|apos|quot);/g;
const decodeMap: Record<string, string> = {
  gt: ">",
  lt: "<",
  amp: "&",
  apos: "'",
  quot: '"',
};

export const defaultParserOptions = {
  delimiters: [`{{`, `}}`],
  getNamespace: () => Namespaces.HTML,
  getTextMode: () => TextModes.DATA,
  isVoidTag: NO,
  isPreTag: NO,
  isCustomElement: NO,
  decodeEntities: (rawText: string): string =>
    rawText.replace(decodeRE, (_, p1) => decodeMap[p1]),
  onError: () => {},
  onWarn: () => {},
  comments: false,
};

export function baseParse(content: string, options = {}) {
  // 初始化信息 content的信息 行列位置 字符串被截取到哪里等
  const context = createParserContext(content, options);
  // 生成记录解析过程的游标信息
  const start = getCursor(context);
  // return createRoot(
  parseChildren(context, TextModes.DATA, []);
  // getSelection(context, start)
  // )
}

function createParserContext(content: string, rawOptions) {
  const options = extend({}, defaultParserOptions);

  let key;
  for (key in rawOptions) {
    // @ts-ignore
    options[key] =
      rawOptions[key] === undefined
        ? defaultParserOptions[key]
        : rawOptions[key];
  }
  return {
    options,
    column: 1,
    line: 1,
    offset: 0,
    originalSource: content, // 原始template
    source: content, // 不断被截取的template
    inPre: false,
    inVPre: false,
    onWarn: options.onWarn,
  };
}

function parseChildren(context, mode, ancestors) {
  const parent = last(ancestors); // 获取当前节点的父节点
  const ns = Namespaces.HTML;
  const nodes = [];
  while (!isEnd(context, mode, ancestors)) {
    const s = context.source;
    let node = undefined;
    if (mode === TextModes.DATA || mode === TextModes.RCDATA) {
      if (!context.inVPre && startsWith(s, context.options.delimiters[0])) {
        // 处理表达式'{{'
        node = parseInterpolation(context, mode);
      } else if (mode === TextModes.DATA && s[0] === "<") {
        if (/[a-z]/i.test(s[1])) {
          node = parseElement(context, ancestors);
        }
      }
    }
  }
}

function parseInterpolation(context, mode) {}

function parseElement(context, ancestors) {
  // Start tag.
  const wasInPre = context.inPre;
  const wasInVPre = context.inVPre;
  const parent = last(ancestors);
  const element = parseTag(context, TagType.Start, parent);
  debugger
  const isPreBoundary = context.inPre && !wasInPre;
  const isVPreBoundary = context.inVPre && !wasInVPre;
  // Children.
  ancestors.push(element)
  const mode = context.options.getTextMode(element, parent)
  const children = parseChildren(context, mode, ancestors)
  ancestors.pop()
}

function parseTag(context, type: TagType, parent) {
  // Tag open.
  const start = getCursor(context);
  // 取到标签
  // 0: "<div"
  // 1: "div"
  const match = /^<\/?([a-z][^\t\r\n\f />]*)/i.exec(context.source)!;
  const tag = match[1]; // 标签名 div
  const ns = context.options.getNamespace(tag, parent);
  advanceBy(context, match[0].length); //match[0].length: <div   截取<div 并更新游标信息
  advanceSpaces(context); // 删除空格

  const cursor = getCursor(context);
  const currentSource = context.source;

  // Attributes.
  let props = parseAttributes(context, type);

  // Tag close.
  let isSelfClosing = false
  isSelfClosing = startsWith(context.source, '/>')
  advanceBy(context, isSelfClosing ? 2 : 1)  // 删除结束标签 > 或 />

  let tagType = ElementTypes.ELEMENT
  return {
    type: NodeTypes.ELEMENT,
    ns,
    tag,
    tagType,
    props,
    isSelfClosing,
    children: [],
    loc: getSelection(context, start),
    codegenNode: undefined // to be created during transform phase
  }
}

// 解析属性Attributes
function parseAttributes(context, type: TagType) {
  const props = [];
  const attributeNames = new Set<string>();
  while (
    context.source.length > 0 &&
    !startsWith(context.source, ">") &&
    !startsWith(context.source, "/>")
  ) {
    const attr = parseAttribute(context, attributeNames);
    
    if (
      attr.type === NodeTypes.ATTRIBUTE &&
      attr.value &&
      attr.name === "class"
    ) {
      attr.value.content = attr.value.content.replace(/\s+/g, " ").trim();
    }

    if (type === TagType.Start) {
      props.push(attr);
    }
    advanceSpaces(context);
  }
  return props;
}

function parseAttribute(context, nameSet: Set<string>) {
  // a = "1"
  // Name.
  const start = getCursor(context);
  const match = /^[^\t\r\n\f />][^\t\r\n\f />=]*/.exec(context.source)!;
  const name = match[0]; // a
  nameSet.add(name); // ['a']
  advanceBy(context, name.length);

  // Value
  let value = undefined;
  if (/^[\t\r\n\f ]*=/.test(context.source)) {
    advanceSpaces(context); // 删空格
    advanceBy(context, 1); // 删=号
    advanceSpaces(context); // 删空格
    value = parseAttributeValue(context);
  }
  const loc = getSelection(context, start);

  if (!context.inVPre && /^(v-[A-Za-z0-9-]|:|\.|@|#)/.test(name)) {
    const match =
      /(?:^v-([a-z0-9-]+))?(?:(?::|^\.|^@|^#)(\[[^\]]+\]|[^\.]+))?(.+)?$/i.exec(
        name
      )!;
    let isPropShorthand = startsWith(name, ".");
    let dirName =
      match[1] ||
      (isPropShorthand || startsWith(name, ":")
        ? "bind"
        : startsWith(name, "@")
        ? "on"
        : "slot");
    let arg;
    if (match[2]) {
      const isSlot = dirName === "slot";
      const startOffset = name.lastIndexOf(match[2]);
      const loc = getSelection(
        context,
        getNewPosition(context, start, startOffset),
        getNewPosition(
          context,
          start,
          startOffset + match[2].length + ((isSlot && match[3]) || "").length
        )
      );
      let content = match[2];
      let isStatic = true;
      arg = {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content,
        isStatic,
        constType: isStatic
          ? ConstantTypes.CAN_STRINGIFY
          : ConstantTypes.NOT_CONSTANT,
        loc,
      };
    }
    if (value && value.isQuoted) {
      const valueLoc = value.loc;
      valueLoc.start.offset++;
      valueLoc.start.column++;
      valueLoc.end = advancePositionWithClone(valueLoc.start, value.content);
      valueLoc.source = valueLoc.source.slice(1, -1);
    }
    const modifiers = match[3] ? match[3].slice(1).split(".") : [];
    return {
      type: NodeTypes.DIRECTIVE,
      name: dirName,
      exp: value && {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: value.content,
        isStatic: false,
        // Treat as non-constant by default. This can be potentially set to
        // other values by `transformExpression` to make it eligible for hoisting.
        constType: ConstantTypes.NOT_CONSTANT,
        loc: value.loc,
      },
      arg,
      modifiers,
      loc,
    };
  }

  // 普通的属性
  return {
    type: NodeTypes.ATTRIBUTE,
    name,
    value: value && {
      type: NodeTypes.TEXT,
      content: value.content,
      loc: value.loc,
    },
    loc,
  };
}

function getNewPosition(context, start, numberOfCharacters: number) {
  return advancePositionWithClone(
    start,
    context.originalSource.slice(start.offset, numberOfCharacters),
    numberOfCharacters
  );
}

function parseAttributeValue(context) {
  const start = getCursor(context);
  let content: string;

  const quote = context.source[0];
  const isQuoted = quote === `"` || quote === `'`;
  if (isQuoted) {
    // Quoted value.
    advanceBy(context, 1); // 删引号
    const endIndex = context.source.indexOf(quote);
    content = parseTextData(context, endIndex, TextModes.ATTRIBUTE_VALUE);
    advanceBy(context, 1); // 删引号
  } else {
    console.warn("no quote!");
  }
  return { content, isQuoted, loc: getSelection(context, start) };
}

function parseTextData(context, length: number, mode: TextModes): string {
  const rawText = context.source.slice(0, length);
  advanceBy(context, length);
  if (
    mode === TextModes.RAWTEXT ||
    mode === TextModes.CDATA ||
    !rawText.includes("&")
  ) {
    return rawText;
  } else {
    // DATA or RCDATA containing "&"". Entity decoding required.
    return context.options.decodeEntities(
      rawText,
      mode === TextModes.ATTRIBUTE_VALUE
    );
  }
}

// 删除空格
function advanceSpaces(context): void {
  const match = /^[\t\r\n\f ]+/.exec(context.source);
  if (match) {
    advanceBy(context, match[0].length);
  }
}

// 获取游标位置信息
function getCursor(context) {
  const { column, line, offset } = context;
  return { column, line, offset };
}

// 更新行列信息 并删除特定长度
function advanceBy(context, numberOfCharacters: number): void {
  const { source } = context;
  // 更新行列信息
  advancePositionWithMutation(context, source, numberOfCharacters);
  context.source = source.slice(numberOfCharacters);
}

function getSelection(context, start, end?) {
  end = end || getCursor(context);
  return {
    start,
    end,
    source: context.originalSource.slice(start.offset, end.offset),
  };
}

function last<T>(xs: T[]): T | undefined {
  return xs[xs.length - 1];
}

function startsWith(source: string, searchString: string): boolean {
  return source.startsWith(searchString);
}

function isEnd(context, mode: TextModes, ancestors) {
  const s = context.source;
  switch (mode) {
    case TextModes.DATA:
      if (startsWith(s, "</")) {
        // TODO: probably bad performance
        for (let i = ancestors.length - 1; i >= 0; --i) {
          if (startsWithEndTagOpen(s, ancestors[i].tag)) {
            return true;
          }
        }
      }
      break;

    case TextModes.RCDATA:
    case TextModes.RAWTEXT: {
      const parent = last(ancestors) as any;
      if (parent && startsWithEndTagOpen(s, parent.tag)) {
        return true;
      }
      break;
    }

    case TextModes.CDATA:
      if (startsWith(s, "]]>")) {
        return true;
      }
      break;
  }

  return !s;
}

function startsWithEndTagOpen(source: string, tag: string): boolean {
  return (
    startsWith(source, "</") &&
    source.slice(2, 2 + tag.length).toLowerCase() === tag.toLowerCase() &&
    /[\t\r\n\f />]/.test(source[2 + tag.length] || ">")
  );
}

import { extend, NO } from "@vue/shared"
import { Namespaces } from "./ast"

export const enum TextModes {
  //          | Elements | Entities | End sign              | Inside of
  DATA, //    | ✔        | ✔        | End tags of ancestors |
  RCDATA, //  | ✘        | ✔        | End tag of the parent | <textarea>
  RAWTEXT, // | ✘        | ✘        | End tag of the parent | <style>,<script>
  CDATA,
  ATTRIBUTE_VALUE
}

const enum TagType {
  Start,
  End
}

// The default decoder only provides escapes for characters reserved as part of
// the template syntax, and is only used if the custom renderer did not provide
// a platform-specific decoder.
const decodeRE = /&(gt|lt|amp|apos|quot);/g
const decodeMap: Record<string, string> = {
  gt: '>',
  lt: '<',
  amp: '&',
  apos: "'",
  quot: '"'
}

export const defaultParserOptions = {
  delimiters: [`{{`, `}}`],
  getNamespace: () => Namespaces.HTML,
  getTextMode: () => TextModes.DATA,
  isVoidTag: NO,
  isPreTag: NO,
  isCustomElement: NO,
  decodeEntities: (rawText: string): string =>
    rawText.replace(decodeRE, (_, p1) => decodeMap[p1]),
  onError: ()=> {},
  onWarn: ()=> {},
  comments: false
}

export function baseParse(
  content: string,
  options = {}
) {
  debugger
  const context = createParserContext(content, options)
  const start = getCursor(context)
  // return createRoot(
    parseChildren(context, TextModes.DATA, [])
  //   getSelection(context, start)
  // )
}

function createParserContext(
  content: string,
  rawOptions
) {
  const options = extend({}, defaultParserOptions)

  let key
  for (key in rawOptions) {
    // @ts-ignore
    options[key] =
      rawOptions[key] === undefined
        ? defaultParserOptions[key]
        : rawOptions[key]
  }
  return {
    options,
    column: 1,
    line: 1,
    offset: 0,
    originalSource: content,
    source: content,
    inPre: false,
    inVPre: false,
    onWarn: options.onWarn
  }
}

function parseChildren(
  context,
  mode,
  ancestors
){
  const parent = last(ancestors)
  const ns = Namespaces.HTML
  const nodes = []
  while (!isEnd(context, mode, ancestors)) {
    const s = context.source
    let node = undefined
    if (mode === TextModes.DATA || mode === TextModes.RCDATA) {
      if (!context.inVPre && startsWith(s, context.options.delimiters[0])) {
        // '{{'
        // node = parseInterpolation(context, mode)
      }else if(mode === TextModes.DATA && s[0] === '<'){
        if(/[a-z]/i.test(s[1])){
          node = parseElement(context, ancestors)
        }
      }
    }
  }
}

function parseElement(
  context,
  ancestors
){
  // Start tag.
  const wasInPre = context.inPre
  const wasInVPre = context.inVPre
  const parent = last(ancestors)
  const element = parseTag(context, TagType.Start, parent)
  const isPreBoundary = context.inPre && !wasInPre
  const isVPreBoundary = context.inVPre && !wasInVPre

}

function parseTag(
  context,
  type: TagType,
  parent
){
  // Tag open.
  const start = getCursor(context)
  const match = /^<\/?([a-z][^\t\r\n\f />]*)/i.exec(context.source)!
  const tag = match[1]
  const ns = context.options.getNamespace(tag, parent)
  // debugger
}

function getCursor(context) {
  const { column, line, offset } = context
  return { column, line, offset }
}

function getSelection(
  context,
  start,
  end
) {
  end = end || getCursor(context)
  return {
    start,
    end,
    source: context.originalSource.slice(start.offset, end.offset)
  }
}

function last<T>(xs: T[]): T | undefined {
  return xs[xs.length - 1]
}

function startsWith(source: string, searchString: string): boolean {
  return source.startsWith(searchString)
}

function isEnd(
  context,
  mode: TextModes,
  ancestors
){
  const s = context.source
  switch (mode) {
    case TextModes.DATA:
      if (startsWith(s, '</')) {
        // TODO: probably bad performance
        for (let i = ancestors.length - 1; i >= 0; --i) {
          if (startsWithEndTagOpen(s, ancestors[i].tag)) {
            return true
          }
        }
      }
      break
  }

  return !s
}

function startsWithEndTagOpen(source: string, tag: string): boolean {
  return (
    startsWith(source, '</') &&
    source.slice(2, 2 + tag.length).toLowerCase() === tag.toLowerCase() &&
    /[\t\r\n\f />]/.test(source[2 + tag.length] || '>')
  )
}

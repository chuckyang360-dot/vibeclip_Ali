export type UserFriendlyParseError = {
  title?: string;
  message: string;
  suggestions?: string[];
};

export const PRODUCT_IMAGE_TOO_LARGE_ERROR: UserFriendlyParseError = {
  title: '图片过大，暂时无法解析',
  message: '当前上传的图片体积过大，暂时无法完成识别。请压缩图片后重新上传，或更换一张尺寸更小、主体更清晰的产品图。',
  suggestions: [
    '使用截图或压缩后的商品图重新上传；',
    '尽量使用单张清晰主图，避免上传超高清原图；',
    '图片主体保持清晰，产品占画面主要区域；',
    '重新上传后再次点击「解析产品信息」。',
  ],
};

export const PRODUCT_IMAGE_TOO_LARGE_SHORT_MESSAGE =
  '图片过大，暂时无法完成识别。请压缩图片或更换较小尺寸的产品图后重试。';

export const PRODUCT_PARSE_GENERIC_MESSAGE =
  '产品解析失败，请检查输入内容或稍后重试。';

export const PRODUCT_PARSE_SERVICE_UNAVAILABLE_MESSAGE =
  '产品解析服务暂时异常，请稍后重试。';

export const PRODUCT_PARSE_UPSTREAM_UNAVAILABLE_TITLE = '解析暂时失败';
export const PRODUCT_PARSE_UPSTREAM_UNAVAILABLE_MESSAGE =
  '当前服务繁忙，请稍后重试。你也可以先手动填写产品信息并保存草稿。';

const PRODUCT_IMAGE_TOO_LARGE_PATTERNS = [
  /maximum prompt length/i,
  /request contains/i,
  /\btoken(?:s)?\b/i,
  /prompt length/i,
  /xAI Responses API HTTP 400/i,
  /图片 payload 过大/i,
  /image data too large/i,
  /input_text_lengths/i,
  /payload too large/i,
];

export function isProductImageTooLargeError(message: string): boolean {
  return PRODUCT_IMAGE_TOO_LARGE_PATTERNS.some((pattern) => pattern.test(message));
}

export function normalizeProductParseError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || '');
  if (isProductImageTooLargeError(message)) return PRODUCT_IMAGE_TOO_LARGE_SHORT_MESSAGE;
  if (
    /upstream_unavailable/i.test(message) ||
    /service temporarily unavailable/i.test(message) ||
    /\bHTTP\s*503\b/i.test(message) ||
    /\bHTTP\s*502\b/i.test(message)
  ) {
    return PRODUCT_PARSE_UPSTREAM_UNAVAILABLE_MESSAGE;
  }
  if (/^Product parse failed$/i.test(message)) return PRODUCT_PARSE_GENERIC_MESSAGE;
  if (/Internal Server Error/i.test(message) || /\bHTTP\s*500\b/i.test(message)) {
    return PRODUCT_PARSE_SERVICE_UNAVAILABLE_MESSAGE;
  }
  if (!message.trim()) return PRODUCT_PARSE_GENERIC_MESSAGE;
  return PRODUCT_PARSE_GENERIC_MESSAGE;
}

export function getUserFriendlyParseError(message: string): UserFriendlyParseError {
  if (message === PRODUCT_IMAGE_TOO_LARGE_SHORT_MESSAGE || isProductImageTooLargeError(message)) {
    return PRODUCT_IMAGE_TOO_LARGE_ERROR;
  }
  if (message === PRODUCT_PARSE_UPSTREAM_UNAVAILABLE_MESSAGE) {
    return { title: PRODUCT_PARSE_UPSTREAM_UNAVAILABLE_TITLE, message: PRODUCT_PARSE_UPSTREAM_UNAVAILABLE_MESSAGE };
  }
  if (message === 'Product parse failed') {
    return { message: PRODUCT_PARSE_GENERIC_MESSAGE };
  }
  if (message === 'Internal Server Error' || message === '500') {
    return { message: PRODUCT_PARSE_SERVICE_UNAVAILABLE_MESSAGE };
  }
  return { message: PRODUCT_PARSE_GENERIC_MESSAGE };
}

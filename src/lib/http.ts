/**
 * 带基础URL的通用HTTP请求封装
 */

// 基础服务URL（可根据环境变量切换）
export const MVMZ_SERVICE_URL = "http://localhost:5000";

// 定义请求方法类型
type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

// 定义请求配置接口
interface RequestOptions {
  method?: HttpMethod;
  headers?: Record<string, string>;
  data?: any; // 请求体数据
  params?: Record<string, any>; // URL参数
  baseUrl?: string; // 可选：覆盖默认基础URL
}

// 定义响应结果接口
interface ResponseResult<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  [key: string]: any;
}

/**
 * 处理URL拼接（基础URL + 接口地址 + 参数）
 */
const resolveUrl = (
  url: string,
  params?: Record<string, any>,
  baseUrl: string = MVMZ_SERVICE_URL
): string => {
  // 处理绝对路径（如果url以http开头，则不拼接基础URL）
  if (url.startsWith("http://") || url.startsWith("https://")) {
    baseUrl = "";
  }

  // 拼接基础URL和接口地址
  const fullUrl = baseUrl
    ? `${baseUrl}${url.startsWith("/") ? "" : "/"}${url}`
    : url;

  // 处理URL参数
  if (!params || Object.keys(params).length === 0) return fullUrl;

  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });

  const separator = fullUrl.includes("?") ? "&" : "?";
  return `${fullUrl}${separator}${searchParams.toString()}`;
};

/**
 * 基础请求方法
 */
export async function request<T = any>(
  url: string,
  options: RequestOptions = {}
): Promise<ResponseResult<T>> {
  const { method = "GET", headers = {}, data, params, baseUrl } = options;

  // 解析完整URL
  const requestUrl = resolveUrl(url, params, baseUrl);

  // 默认请求头
  const defaultHeaders = {
    "Content-Type": "application/json",
    ...headers,
  };

  try {
    const response = await fetch(requestUrl, {
      method,
      headers: defaultHeaders,
      body: method !== "GET" && data ? JSON.stringify(data) : undefined,
    });

    // 解析响应
    let responseData: any;
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    // 处理HTTP错误
    if (!response.ok) {
      throw new Error(
        responseData?.message ||
          `请求失败: ${response.status} ${response.statusText}`
      );
    }

    return responseData as ResponseResult<T>;
  } catch (error) {
    console.error(`请求${requestUrl}失败:`, error);
    throw error instanceof Error
      ? error
      : new Error(`请求失败: ${String(error)}`);
  }
}

/**
 * POST请求快捷方法
 */
export async function post<T = any>(
  url: string,
  data?: any,
  options: Omit<RequestOptions, "method" | "data"> = {}
): Promise<ResponseResult<T>> {
  return request<T>(url, {
    ...options,
    method: "POST",
    data,
  });
}

/**
 * GET请求快捷方法
 */
export async function get<T = any>(
  url: string,
  params?: Record<string, any>,
  options: Omit<RequestOptions, "method" | "params"> = {}
): Promise<ResponseResult<T>> {
  return request<T>(url, {
    ...options,
    method: "GET",
    params,
  });
}

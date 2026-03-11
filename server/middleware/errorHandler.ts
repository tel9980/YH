import { Request, Response, NextFunction } from 'express';

/**
 * 错误响应格式
 */
export interface ErrorResponse {
  error: {
    code: string;           // 错误代码
    message: string;        // 用户友好的错误消息
    details?: any;          // 详细错误信息
    field?: string;         // 相关字段名
    timestamp: string;      // 错误发生时间
  };
}

/**
 * 业务逻辑错误类
 */
export class BusinessError extends Error {
  code: string;
  field?: string;
  statusCode: number;

  constructor(code: string, message: string, field?: string, statusCode: number = 400) {
    super(message);
    this.name = 'BusinessError';
    this.code = code;
    this.field = field;
    this.statusCode = statusCode;
  }
}

/**
 * 统一错误处理中间件
 */
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // 记录错误日志
  console.error(`[${new Date().toISOString()}] Error:`, {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body
  });

  // 数据库约束错误
  if (err.code === 'SQLITE_CONSTRAINT' || err.message?.includes('UNIQUE constraint failed')) {
    return res.status(409).json({
      error: {
        code: 'DUPLICATE_RECORD',
        message: '记录已存在，请检查是否重复',
        details: err.message,
        timestamp: new Date().toISOString()
      }
    } as ErrorResponse);
  }

  // 数据库外键约束错误
  if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    return res.status(400).json({
      error: {
        code: 'FOREIGN_KEY_VIOLATION',
        message: '数据关联错误，请检查相关记录是否存在',
        details: err.message,
        timestamp: new Date().toISOString()
      }
    } as ErrorResponse);
  }

  // 业务逻辑错误
  if (err instanceof BusinessError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        field: err.field,
        timestamp: new Date().toISOString()
      }
    } as ErrorResponse);
  }

  // 验证错误（来自第三方库）
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: '数据验证失败',
        details: err.message,
        timestamp: new Date().toISOString()
      }
    } as ErrorResponse);
  }

  // 数据库连接错误
  if (err.code === 'SQLITE_CANTOPEN' || err.message?.includes('database')) {
    return res.status(500).json({
      error: {
        code: 'DATABASE_ERROR',
        message: '数据库连接失败，请稍后重试',
        details: err.message,
        timestamp: new Date().toISOString()
      }
    } as ErrorResponse);
  }

  // 默认系统错误
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: '系统内部错误，请稍后重试',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
      timestamp: new Date().toISOString()
    }
  } as ErrorResponse);
};

/**
 * 常见错误代码定义
 */
export const ErrorCodes = {
  // 凭证相关错误
  VOUCHER_NOT_BALANCED: 'VOUCHER_NOT_BALANCED',
  VOUCHER_NOT_FOUND: 'VOUCHER_NOT_FOUND',
  VOUCHER_ALREADY_APPROVED: 'VOUCHER_ALREADY_APPROVED',
  
  // 期间相关错误
  PERIOD_CLOSED: 'PERIOD_CLOSED',
  PERIOD_NOT_FOUND: 'PERIOD_NOT_FOUND',
  
  // 科目相关错误
  ACCOUNT_HAS_BALANCE: 'ACCOUNT_HAS_BALANCE',
  ACCOUNT_NOT_FOUND: 'ACCOUNT_NOT_FOUND',
  DUPLICATE_ACCOUNT_CODE: 'DUPLICATE_ACCOUNT_CODE',
  INVALID_ACCOUNT_CODE_FORMAT: 'INVALID_ACCOUNT_CODE_FORMAT',
  
  // 辅助核算错误
  MISSING_AUXILIARY_DATA: 'MISSING_AUXILIARY_DATA',
  
  // 金额相关错误
  INVALID_AMOUNT_PRECISION: 'INVALID_AMOUNT_PRECISION',
  INVALID_AMOUNT: 'INVALID_AMOUNT',
  
  // 结账相关错误
  CLOSING_PRECONDITION_FAILED: 'CLOSING_PRECONDITION_FAILED',
  
  // 成本相关错误
  COST_VARIANCE_THRESHOLD_EXCEEDED: 'COST_VARIANCE_THRESHOLD_EXCEEDED',
  
  // 通用错误
  DUPLICATE_RECORD: 'DUPLICATE_RECORD',
  RECORD_NOT_FOUND: 'RECORD_NOT_FOUND',
  INVALID_INPUT: 'INVALID_INPUT',
  PERMISSION_DENIED: 'PERMISSION_DENIED'
};

/**
 * 创建业务错误的辅助函数
 */
export const createBusinessError = (
  code: string,
  message: string,
  field?: string,
  statusCode?: number
): BusinessError => {
  return new BusinessError(code, message, field, statusCode);
};

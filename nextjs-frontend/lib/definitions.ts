import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password should be at least 8 characters.") // Minimum length validation
  .refine((password) => /[!@#$%^&*(),.?":{}|<>]/.test(password), {
    message: "Password should contain at least one special character.",
  });

export const passwordResetConfirmSchema = z
  .object({
    password: passwordSchema,
    passwordConfirm: z.string(),
    token: z.string().min(1, { message: "Token is required" }),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Passwords must match.",
    path: ["passwordConfirm"],
  });

export const loginSchema = z.object({
  password: z.string().min(1, { message: "Password is required" }),
  username: z.string().min(1, { message: "Username is required" }),
});

export const channelSchema = z.object({
  name: z.string().min(1, { message: "채널명을 입력해주세요" }),
  description: z.string().optional(),
  url: z
    .string()
    .optional()
    .transform((v) => {
      if (v === undefined || v === null) return undefined;
      const t = String(v).trim();
      return t === "" ? undefined : t;
    })
    .refine((v) => v === undefined || v.length <= 2048, {
      message: "URL은 2048자 이내여야 합니다",
    }),
  courier_id: z.string().uuid().optional().nullable(),
  /** 비어 있으면 null; 실제 JSON 검증은 서버 액션에서 수행 */
  order_excel_mapping: z.string().optional(),
});

export const categorySchema = z.object({
  name: z.string().min(1, { message: "카테고리명을 입력해주세요" }),
  description: z.string().optional(),
  parent_id: z.string().uuid().optional().nullable(),
});

export const productSchema = z.object({
  product_code: z.string().min(1, { message: "상품 코드를 입력해주세요" }),
  name: z.string().min(1, { message: "상품명을 입력해주세요" }),
  description: z.string().optional(),
  price: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === "" || v === undefined ? 0 : Number(v)))
    .refine((v) => Number.isInteger(v) && v >= 0, {
      message: "가격은 0 이상의 정수여야 합니다",
    }),
  category_id: z.string().min(1, { message: "카테고리를 선택해주세요" }),
  is_tax: z.boolean().default(false),
  tax_rate: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : Number(v)))
    .refine((v) => v === undefined || (typeof v === "number" && v >= 0 && v <= 100), {
      message: "세율은 0~100 사이여야 합니다",
    }),
  max_shipping_number: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : Number(v)))
    .refine((v) => v === undefined || (Number.isInteger(v) && v >= 1), {
      message: "최대 배송 갯수는 1 이상의 정수여야 합니다",
    }),
  state: z.enum(["active", "inactive", "discontinued"]).default("active"),
});

export const stockSchema = z.object({
  logistics_location_id: z
    .string()
    .min(1, { message: "물류지를 선택해주세요" }),
  product_id: z.string().min(1, { message: "상품을 선택해주세요" }),
  quantity: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === "string" ? Number(v) : v))
    .refine((v) => Number.isInteger(v) && v > 0, {
      message: "수량은 1 이상의 정수여야 합니다",
    }),
  batch_code: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, { message: "배치코드를 입력해주세요" })),
  stock_date: z.string().optional(),
  expiration_date: z.string().min(1, { message: "유통기한을 입력해주세요" }),
  condition: z.enum(["normal", "refurb", "disposal", "undecided"]).default("normal"),
  memo: z.string().max(500).optional(),
  product_barcode: z.string().max(50).optional(),
});

export const productAliasDictSchema = z.object({
  channel_id: z
    .string()
    .optional()
    .transform((v) => (v == null ? undefined : String(v).trim()))
    .refine((v) => v === undefined || v === "" || v.length > 0, {
      message: "채널을 선택해주세요",
    }),
  alias: z.string().min(1, { message: "별칭을 입력해주세요" }),
  price: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : Number(v)))
    .refine((v) => v === undefined || (Number.isInteger(v) && v >= 0), {
      message: "가격은 0 이상의 정수여야 합니다",
    }),
  commission: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : Number(v)))
    .refine((v) => v === undefined || (Number.isInteger(v) && v >= 0), {
      message: "수수료는 0 이상의 정수여야 합니다",
    }),
  items_json: z.string().min(1, { message: "상품을 한 개 이상 추가해주세요" }),
});

export const receiverSchema = z.object({
  name: z.string().min(1, { message: "수취인명을 입력해주세요" }),
  phone: z.string().min(1, { message: "연락처를 입력해주세요" }),
  zip_code: z.string().min(1, { message: "우편번호를 입력해주세요" }),
  address: z.string().min(1, { message: "주소를 입력해주세요" }),
  address_detail: z.string().optional(),
  email: z.string().optional(),
});

export const orderSchema = z.object({
  product_id: z.string().min(1, { message: "상품을 선택해주세요" }),
  receiver_id: z.string().min(1, { message: "수취인을 선택해주세요" }),
  price: z
    .string()
    .min(1, { message: "금액을 입력해주세요" })
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, {
      message: "올바른 금액을 입력해주세요",
    }),
  quantity: z
    .string()
    .min(1, { message: "수량을 입력해주세요" })
    .refine((v) => /^\d+$/.test(v) && Number(v) > 0, {
      message: "수량은 1 이상의 정수여야 합니다",
    }),
  memo: z.string().optional(),
});

/** 주문 등록 시 수취인 선택 없이 입력하는 경우 사용 (receiver_id 제외) */
export const orderFormSchema = z.object({
  channel_id: z.string().min(1, { message: "채널을 선택해주세요" }),
  price: z
    .string()
    .min(1, { message: "금액을 입력해주세요" })
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, {
      message: "올바른 금액을 입력해주세요",
    }),
  memo: z.string().optional(),
  items_json: z.string().min(1, { message: "상품을 한 개 이상 추가해주세요" }),
});

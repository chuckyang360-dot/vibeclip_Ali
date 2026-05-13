# Vibe Clip Admin

## 1. Project Description
Vibe Clip 是面向电商商家的 AI 商品营销短剧生成平台。本次项目为其设计并开发后台管理系统（Admin Dashboard），面向平台运营者、管理员和产品负责人。后台用于监控平台整体运行状态、管理用户与项目、追踪 API 调用与积分消耗、处理异常任务，并支持对用户积分和账号状态进行可审计的手动管理。

## 2. Page Structure
- `/` - Dashboard 总览（平台核心数据、趋势图、API Health、异常任务、高消耗用户）
- `/users` - Users 用户管理（注册用户列表、搜索筛选、操作）
- `/projects` - Projects 项目管理（短剧项目列表、状态追踪、筛选）
- `/api-logs` - API Logs API 调用日志（API 调用追踪、成功率分析）
- `/credits` - Credits 积分管理（预留页面，后续扩展）
- `/admin-logs` - Admin Logs 管理员操作日志（预留页面，后续扩展）
- `/settings` - Settings 系统设置（预留页面，后续扩展）

## 3. Core Features
- [x] Dashboard 总览：核心数据卡片、趋势图表、API Health 监控、异常任务追踪、高消耗用户排名
- [x] Users 用户管理：用户列表、搜索筛选、状态管理、积分授予、导出
- [x] Projects 项目管理：项目列表、状态筛选、步骤追踪、错误定位
- [x] API Logs API 调用日志：API 调用记录、成功率统计、成本分析
- [ ] Credits 积分管理：积分充值记录、消耗明细、手动调整（后续扩展）
- [ ] Admin Logs 管理员操作日志：可审计的操作记录（后续扩展）
- [ ] Settings 系统设置：平台参数配置（后续扩展）

## 4. Data Model Design
当前阶段使用 Mock 数据展示，后续可接入 Supabase 真实数据源。

### Table: users（预留）
| Field | Type | Description |
|-------|------|-------------|
| id | uuid | 主键 |
| email | text | 邮箱 |
| username | text | 用户名 |
| status | text | 状态：normal / disabled / risk |
| subscription | text | 订阅：free / paid / expired / canceled |
| credit_balance | integer | 积分余额 |
| created_at | timestamptz | 注册时间 |
| last_login | timestamptz | 最后登录 |

### Table: projects（预留）
| Field | Type | Description |
|-------|------|-------------|
| id | uuid | 主键 |
| name | text | 项目名称 |
| user_id | uuid | 所属用户 |
| status | text | 状态：draft / processing / completed / error |
| current_step | text | 当前步骤：S0-S4 |
| credits_used | integer | 消耗积分 |
| api_calls | integer | API 调用次数 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

### Table: api_logs（预留）
| Field | Type | Description |
|-------|------|-------------|
| id | uuid | 主键 |
| provider | text | 服务商 |
| model | text | 模型 |
| business_type | text | 业务类型 |
| user_id | uuid | 用户 |
| project_id | uuid | 项目 |
| status | text | 状态 |
| duration | integer | 耗时(ms) |
| estimated_cost | numeric | 预估成本 |
| created_at | timestamptz | 创建时间 |

## 5. Backend / Third-party Integration Plan
- **Supabase**：当前未连接，后续可接入用于用户认证、数据存储、API 日志记录
- **Shopify**：不涉及，后台管理系统无需电商前端
- **Stripe**：不涉及，后台管理系统无需前端支付

## 6. Development Phase Plan

### Phase 1: 核心页面搭建
- Goal：完成全局布局（Sidebar + Header + Layout）和 Dashboard、Users、Projects 三个核心页面
- Deliverable：
  - 全局布局组件（深色 Sidebar + 浅色主内容区 + Header）
  - Dashboard 页面（10个数据卡片 + 3个趋势图 + API Health + 异常任务表格 + 高消耗用户表格）
  - Users 页面（搜索筛选 + 完整用户表格 + 操作按钮）
  - Projects 页面（搜索筛选 + 完整项目表格 + 状态追踪）
  - API Logs 页面基础结构

### Phase 2: 高级功能与扩展页面
- Goal：完成 API Logs 详情页面、Credits 积分管理、Admin Logs 操作日志、Settings 系统设置
- Deliverable：
  - API Logs 完整筛选与详情
  - Credits 积分流水与手动调整
  - Admin Logs 可审计操作记录
  - Settings 平台参数配置

### Phase 3: 数据接入与优化
- Goal：接入 Supabase 真实数据，优化交互体验
- Deliverable：
  - 替换 Mock 数据为真实 API
  - 分页、排序、导出 CSV 功能
  - 响应式移动端适配优化
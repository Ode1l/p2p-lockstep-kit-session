# Session 层单元测试指南

## 快速开始

### 1. 安装测试依赖

```bash
npm install --save-dev vitest @vitest/ui
```

### 2. 配置 vitest

在 `package.json` 中添加脚本：

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:watch": "vitest --watch"
  }
}
```

### 3. 运行测试

```bash
# 运行所有测试
npm test

# 监听模式（开发中推荐）
npm run test:watch

# UI 界面查看
npm run test:ui
```

---

## 文件结构

```
src/session/
├── __tests__/
│   ├── commandBus.test.ts      # CommandBus 单元测试
│   ├── netClient.test.ts       # NetClient 单元测试
│   └── context.test.ts         # SessionContext 单元测试
├── commandBus.ts
├── net.ts
├── context.ts
└── index.ts
```

---

## 测试覆盖率

已创建的测试覆盖：

### CommandBus (`commandBus.test.ts`)
- ✅ 消息发送和监听
- ✅ 多个监听器
- ✅ 监听器移除
- ✅ 异步处理
- ✅ 错误捕获（同步和异步）
- ✅ 一个监听器失败不影响其他

**运行**: `npm test commandBus.test.ts`

### NetClient (`netClient.test.ts`)
- ✅ 消息转发到 Bus
- ✅ 连接状态跟踪
- ✅ ONLINE/OFFLINE 事件发送
- ✅ 连接时拒绝发送
- ✅ 对等体 ID 管理
- ✅ 媒体流状态

**运行**: `npm test netClient.test.ts`

### SessionContext (`context.test.ts`)
- ✅ 初始化检查
- ✅ 获取上下文
- ✅ 重置上下文
- ✅ 多个会话支持
- ✅ 会话 ID 管理

**运行**: `npm test context.test.ts`

---

## 如何编写新的单元测试

### 1. 基础测试模板

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { YourClass } from '../yourClass';

describe('YourClass', () => {
  let instance: YourClass;

  beforeEach(() => {
    // Setup
    instance = new YourClass();
  });

  afterEach(() => {
    // Cleanup
  });

  it('should do something', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = instance.method(input);

    // Assert
    expect(result).toBe('expected');
  });
});
```

### 2. Mock 示例

```typescript
import { vi } from 'vitest';

// Mock 函数
const mockFunction = vi.fn();
const mockFunctionWithReturn = vi.fn(() => 'mocked value');

// 监视函数调用
const spyFn = vi.spyOn(object, 'method');
expect(spyFn).toHaveBeenCalledWith(arg1, arg2);
expect(spyFn).toHaveBeenCalledTimes(1);

// Mock console
const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation();
```

### 3. 异步测试

```typescript
it('should handle async operations', async () => {
  // 使用 await
  const result = await asyncFunction();
  expect(result).toBe(expected);
});

it('should delay execution', async () => {
  // 等待时间
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(something).toBe(true);
});
```

### 4. 测试状态管理（如 State 类）

```typescript
describe('State', () => {
  let state: State;

  beforeEach(() => {
    state = new State(null, null);
  });

  it('should update turn count when action added', () => {
    state.pushHistory({ turn: 1, player: 'local', move: {} });
    expect(state.getTurnCount()).toBe(2);
  });

  it('should track FSM state transitions', () => {
    state.dispatch('local', 'READY');
    expect(state.getState('local')).toBe('ready');
  });
});
```

---

## 测试最佳实践

### 1. 使用 AAA 模式

```typescript
it('should calculate total', () => {
  // Arrange - 准备测试数据
  const item1 = { price: 10 };
  const item2 = { price: 20 };

  // Act - 执行操作
  const total = calculate([item1, item2]);

  // Assert - 验证结果
  expect(total).toBe(30);
});
```

### 2. 一个 test 一个概念

```typescript
// ✅ 好
it('should emit ONLINE when connected', () => {
  mockNetwork.simulateStateChange('connected');
  expect(busEmitSpy).toHaveBeenCalledWith('ONLINE', undefined, 'local');
});

// ❌ 差 - 测试多个概念
it('should handle connection', () => {
  mockNetwork.simulateStateChange('connected');
  expect(netClient.isConnected).toBe(true);
  expect(busEmitSpy).toHaveBeenCalledWith('ONLINE');
  expect(listener).toHaveBeenCalled();
});
```

### 3. 清晰的测试名称

```typescript
// ✅ 好 - 说明了 when 和 should
it('should reject send when not connected', () => {
  // ...
});

// ❌ 差 - 不清楚
it('send test', () => {
  // ...
});
```

### 4. 避免测试实现细节

```typescript
// ❌ 不好 - 测试私有属性
expect(instance['private_field']).toBe(value);

// ✅ 好 - 测试公共 API
expect(instance.getPublicValue()).toBe(value);
```

### 5. Mock 外部依赖

```typescript
// ✅ 好 - Mock NetworkClient
const mockNetwork = new MockNetworkClient();
const netClient = new NetClient(mockNetwork, bus, null);

// ✅ 好 - Mock console
const consoleSpy = vi.spyOn(console, 'error').mockImplementation();
```

---

## Handler 的集成测试

对于 handlers（在 `src/session/handlers/` 中），推荐编写集成测试：

```typescript
// handlers/__tests__/move.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createSession } from '../../index';
import { move } from '../move';

describe('Move Handler', () => {
  let session: any;

  beforeEach(() => {
    session = createSession();
    // 初始化游戏
  });

  it('should transition FSM when valid move', () => {
    // 初始状态
    expect(session.state.getState('local')).toBe('turn');

    // 发送 MOVE 命令
    session.bus.emit('MOVE', { x: 5, y: 5 }, 'local');

    // 验证状态转移
    expect(session.state.getState('local')).toBe('remote_turn');
  });

  it('should ignore invalid move', () => {
    // 不在 'turn' 状态，发送 MOVE
    session.state.dispatch('local', 'READY');

    session.bus.emit('MOVE', { x: 5, y: 5 }, 'local');

    // 状态不变
    expect(session.state.getState('local')).toBe('ready');
  });
});
```

---

## 调试技巧

### 1. 打印输出

```typescript
it('should debug', () => {
  console.log('Current state:', instance.getState());
  const result = instance.method();
  console.log('Result:', result);
});

// 运行: npm test -- --reporter=verbose
```

### 2. 只运行一个测试

```typescript
// 使用 it.only
it.only('should debug this specific case', () => {
  // ...
});
```

### 3. 跳过某个测试

```typescript
// 使用 it.skip
it.skip('should skip this', () => {
  // ...
});
```

### 4. 使用 Vitest UI 调试

```bash
npm run test:ui
# 打开 http://localhost:51204 浏览器界面
```

---

## 代码覆盖率

生成代码覆盖率报告：

```bash
npm test -- --coverage
```

目标覆盖率：
- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 80%
- **Lines**: > 80%

---

## 常见问题

### Q1: 如何测试私有方法？
**A**: 不要测试私有方法，只测试公共 API。如果必须测试，说明设计有问题。

### Q2: 如何处理全局单例（如 SessionContext）？
**A**: 在 `afterEach` 中调用 `resetContext()` 重置状态：

```typescript
afterEach(() => {
  resetContext(); // 清理全局单例
});
```

### Q3: 异步测试超时怎么办？
**A**: 增加超时时间：

```typescript
it('slow async operation', async () => {
  // ...
}, 10000); // 10 秒超时
```

### Q4: 如何 mock 异步函数？
**A**: 使用 `vi.fn().mockResolvedValue()`:

```typescript
const mockAsync = vi.fn().mockResolvedValue('result');
const result = await mockAsync();
expect(result).toBe('result');
```

---

## 下一步

1. ✅ 为 State 类编写更多测试（状态转移、历史记录）
2. ✅ 为各个 handler 编写集成测试
3. ✅ 达到 80%+ 的代码覆盖率
4. ✅ 设置 CI 自动运行测试



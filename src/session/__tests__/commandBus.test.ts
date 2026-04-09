import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommandBus } from '../commandBus';

describe('CommandBus', () => {
  let bus: CommandBus;

  beforeEach(() => {
    bus = new CommandBus();
  });

  describe('emit and on', () => {
    it('should call listener when message is emitted', () => {
      const listener = vi.fn();
      bus.on(listener);

      bus.emit('MOVE', { x: 10 }, 'local');

      expect(listener).toHaveBeenCalledWith({
        type: 'MOVE',
        payload: { x: 10 },
        from: 'local',
      });
    });

    it('should call multiple listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      bus.on(listener1);
      bus.on(listener2);

      bus.emit('READY');

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should default origin to local', () => {
      const listener = vi.fn();
      bus.on(listener);

      bus.emit('MOVE', {});

      expect(listener).toHaveBeenCalledWith({
        type: 'MOVE',
        payload: {},
        from: 'local',
      });
    });

    it('should handle async listeners', async () => {
      const asyncListener = vi.fn(async () => {
        return new Promise((resolve) => setTimeout(resolve, 10));
      });
      bus.on(asyncListener);

      bus.emit('MOVE', {});

      // Listeners execute in background, give time to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(asyncListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('off', () => {
    it('should remove listener', () => {
      const listener = vi.fn();
      bus.on(listener);
      bus.off(listener);

      bus.emit('MOVE', {});

      expect(listener).not.toHaveBeenCalled();
    });

    it('should not throw if removing non-existent listener', () => {
      const listener = vi.fn();
      expect(() => bus.off(listener)).not.toThrow();
    });

    it('should clean up empty listeners set', () => {
      const listener = vi.fn();
      bus.on(listener);
      bus.off(listener);

      // @ts-ignore accessing private property for testing
      expect(bus['listeners'].size).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should catch and log sync errors', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();
      const errorListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      bus.on(errorListener);

      bus.emit('MOVE', {});

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[CommandBus] Error in listener'),
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });

    it('should catch and log async errors', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();
      const asyncErrorListener = vi.fn(async () => {
        throw new Error('Async listener error');
      });
      bus.on(asyncErrorListener);

      bus.emit('MOVE', {});

      // Wait for async listener to execute
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[CommandBus] Error in listener'),
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });

    it('should execute all listeners even if one fails', async () => {
      const listener1 = vi.fn(() => {
        throw new Error('Error 1');
      });
      const listener2 = vi.fn();
      const listener3 = vi.fn(() => {
        throw new Error('Error 3');
      });

      bus.on(listener1);
      bus.on(listener2);
      bus.on(listener3);

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation();

      bus.emit('MOVE', {});

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
      expect(listener3).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });
});


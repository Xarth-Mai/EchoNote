<script lang="ts">
  import { onDestroy } from "svelte";

  export let text: string = "";

  // --- 速度配置 ---
  export let speed: number = 100; // 打字基准速度 (ms)
  export let waitDelay: number = 600; // 清空/回退完毕后的等待时间 (ms)
  export let jitter: number = 0.5; // 速度随机波动幅度 (0.0 - 1.0)，0为匀速

  export let className: string = "";
  export let ariaLabel: string | undefined = undefined;

  let displayedText: string[] = [];
  let cursorVisible = true;
  let processTimer: ReturnType<typeof setTimeout> | null = null;
  let hideCursorTimer: ReturnType<typeof setTimeout> | null = null;

  $: if (text !== undefined) {
    scheduleUpdate(text);
  }

  function scheduleUpdate(targetText: string) {
    clearTimer(processTimer);
    clearTimer(hideCursorTimer);
    cursorVisible = true;
    processStep(targetText);
  }

  // 获取非线性延迟：模拟真实打字的忽快忽慢
  function getNaturalDelay(base: number): number {
    if (jitter === 0) return base;
    // 产生 (1 - jitter) 到 (1 + jitter) 之间的随机倍率
    const variance = 1 + (Math.random() * 2 - 1) * jitter;
    return Math.max(Math.floor(base * variance), 10); // 至少 10ms
  }

  function processStep(targetText: string) {
    const currentStr = displayedText.join("");
    const currentLength = displayedText.length;

    // 1. 完成状态：完全匹配
    if (currentStr === targetText) {
      hideCursorTimer = setTimeout(() => {
        cursorVisible = false;
      }, waitDelay); // 完成后光标停留一会再消失
      return;
    }

    // 2. 决策：退格 (Delete) 还是 输入 (Type)
    // 如果当前内容不是目标的前缀，说明有错误或多余字符，需要退格
    if (!targetText.startsWith(currentStr)) {
      // --- 退格模式 ---
      displayedText = displayedText.slice(0, -1);

      // 预判下一步：
      // 如果退格后，剩下的字符串变成了目标的前缀（例如删空了，或退到了公共部分），
      // 说明下一步该开始打字了。此时插入等待时间。
      const nextStr = currentStr.slice(0, -1);
      if (targetText.startsWith(nextStr)) {
        processTimer = setTimeout(() => processStep(targetText), waitDelay);
      } else {
        // 还没删完，继续快速删除
        processTimer = setTimeout(
          () => processStep(targetText),
          getNaturalDelay(speed),
        );
      }
    } else {
      // --- 输入模式 ---
      const nextChar = targetText[currentLength];
      displayedText = [...displayedText, nextChar];

      // 标点符号后通常停顿稍长一点点 (可选微调细节)
      let currentSpeed = speed;
      if ([",", ".", "!", "?", "，", "。"].includes(nextChar)) {
        currentSpeed *= 1.5;
      }

      processTimer = setTimeout(
        () => processStep(targetText),
        getNaturalDelay(currentSpeed),
      );
    }
  }

  function clearTimer(timer: ReturnType<typeof setTimeout> | null): void {
    if (timer) clearTimeout(timer);
  }

  onDestroy(() => {
    clearTimer(processTimer);
    clearTimer(hideCursorTimer);
  });
</script>

<span class={`typewriter ${className}`} aria-label={ariaLabel ?? text}>
  {#each displayedText as char, i (i)}
    <span class="typewriter__char">
      {char}
    </span>
  {/each}
  {#if cursorVisible}
    <span class="typewriter__cursor" aria-hidden="true"></span>
  {/if}
</span>

<style>
  .typewriter {
    display: inline-flex;
    align-items: baseline;
    gap: 0.02em; /* 字间距微调 */
    font-family: "SFMono-Regular", "Menlo", "JetBrains Mono", monospace;
    font-weight: inherit;
    color: inherit;
    line-height: 1.2;
    white-space: pre-wrap;
  }

  .typewriter__char {
    display: inline-block;
    /* 动画加快到 0.1s，因为 JS 的输入间隔已经有了随机性，
       CSS 动画只需负责“出现”的平滑度，避免闪烁 */
    animation: typewriterReveal 0.1s var(--motion-curve-standard) forwards;
  }

  .typewriter__cursor {
    display: inline-block;
    width: 0.5em;
    height: 1.1em;
    background-color: currentColor;
    margin-left: 0.1em;
    transform: translateY(0.2em);
    /* 无闪烁动画 */
  }

  @keyframes typewriterReveal {
    0% {
      opacity: 0;
      transform: translateY(2px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>

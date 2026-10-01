type Target = FakeNode | FakeParam;

function checkTime(time: number): void {
  if (!Number.isFinite(time)) throw new TypeError(`non-finite time: ${time}`);
  if (time < 0) throw new RangeError(`negative time: ${time}`);
}

function checkValue(value: number): void {
  if (!Number.isFinite(value)) throw new TypeError(`non-finite value: ${value}`);
}

export interface ParamEvent {
  type: 'set' | 'linear' | 'exponential' | 'target';
  value: number;
  time: number;
}

export class FakeParam {
  events: ParamEvent[] = [];
  inputs: FakeNode[] = [];

  constructor(public value: number) {}

  setValueAtTime(value: number, time: number): this {
    checkValue(value);
    checkTime(time);
    this.events.push({ type: 'set', value, time });
    return this;
  }

  linearRampToValueAtTime(value: number, time: number): this {
    checkValue(value);
    checkTime(time);
    this.events.push({ type: 'linear', value, time });
    return this;
  }

  exponentialRampToValueAtTime(value: number, time: number): this {
    checkValue(value);
    checkTime(time);
    if (value <= 0) throw new RangeError(`exponential ramp to ${value}`);
    this.events.push({ type: 'exponential', value, time });
    return this;
  }

  setTargetAtTime(value: number, time: number, constant: number): this {
    checkValue(value);
    checkTime(time);
    checkValue(constant);
    this.events.push({ type: 'target', value, time });
    return this;
  }

  cancelScheduledValues(time: number): this {
    checkTime(time);
    this.events = this.events.filter((event) => event.time < time);
    return this;
  }

  valueAt(time: number): number {
    let value = this.value;
    for (const event of this.events) if (event.time <= time) value = event.value;
    return value;
  }
}

export class FakeNode {
  connections: Target[] = [];
  disconnected = false;

  constructor(
    readonly ctx: FakeAudioContext,
    readonly kind: string,
  ) {
    ctx.nodes.push(this);
  }

  connect<T extends Target>(target: T): T {
    if (target instanceof FakeNode && target.ctx !== this.ctx) throw new Error('connecting nodes of different contexts');
    this.connections.push(target);
    if (target instanceof FakeParam) target.inputs.push(this);
    return target;
  }

  disconnect(): void {
    this.connections = [];
    this.disconnected = true;
  }
}

export class FakeSource extends FakeNode {
  startAt: number | null = null;
  stopAt: number | null = null;
  offset = 0;
  onended: (() => void) | null = null;

  start(when = 0, offset = 0): void {
    checkTime(when);
    if (this.startAt !== null) throw new Error('InvalidStateError: started twice');
    this.startAt = when;
    this.offset = offset;
  }

  stop(when = 0): void {
    checkTime(when);
    if (this.startAt === null) throw new Error('InvalidStateError: stopped before starting');
    this.stopAt = when;
  }

  end(): void {
    this.onended?.();
  }
}

export class FakeOscillator extends FakeSource {
  type = 'sine';
  frequency = new FakeParam(440);
  detune = new FakeParam(0);
}

export class FakeBufferSource extends FakeSource {
  buffer: FakeBuffer | null = null;
  loop = false;
  playbackRate = new FakeParam(1);
}

export class FakeGain extends FakeNode {
  gain = new FakeParam(1);
}

export class FakeFilter extends FakeNode {
  type = 'lowpass';
  frequency = new FakeParam(350);
  Q = new FakeParam(1);
  gain = new FakeParam(0);
}

export class FakeCompressor extends FakeNode {
  threshold = new FakeParam(-24);
  knee = new FakeParam(30);
  ratio = new FakeParam(12);
  attack = new FakeParam(0.003);
  release = new FakeParam(0.25);
}

export class FakeConvolver extends FakeNode {
  buffer: FakeBuffer | null = null;
  normalize = true;
}

export class FakeAnalyser extends FakeNode {
  fftSize = 2048;

  getFloatTimeDomainData(array: Float32Array): void {
    array.fill(this.ctx.output);
  }
}

export class FakeBuffer {
  private readonly channels: Float32Array[];

  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number,
  ) {
    this.channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }

  getChannelData(channel: number): Float32Array {
    const data = this.channels[channel];
    if (!data) throw new Error(`no channel ${channel}`);
    return data;
  }
}

export class FakeAudioContext {
  currentTime = 0;
  sampleRate = 8000;
  state: 'suspended' | 'running' | 'closed' = 'suspended';
  output = 0;
  nodes: FakeNode[] = [];
  resumes = 0;
  suspends = 0;
  onstatechange: (() => void) | null = null;
  readonly destination: FakeNode;

  constructor() {
    this.destination = new FakeNode(this, 'destination');
  }

  createGain(): FakeGain {
    return new FakeGain(this, 'gain');
  }

  createOscillator(): FakeOscillator {
    return new FakeOscillator(this, 'oscillator');
  }

  createBufferSource(): FakeBufferSource {
    return new FakeBufferSource(this, 'buffer');
  }

  createBiquadFilter(): FakeFilter {
    return new FakeFilter(this, 'filter');
  }

  createDynamicsCompressor(): FakeCompressor {
    return new FakeCompressor(this, 'compressor');
  }

  createConvolver(): FakeConvolver {
    return new FakeConvolver(this, 'convolver');
  }

  createAnalyser(): FakeAnalyser {
    return new FakeAnalyser(this, 'analyser');
  }

  createBuffer(channels: number, length: number, sampleRate: number): FakeBuffer {
    return new FakeBuffer(channels, length, sampleRate);
  }

  resume(): Promise<void> {
    this.resumes += 1;
    this.setState('running');
    return Promise.resolve();
  }

  suspend(): Promise<void> {
    this.suspends += 1;
    this.setState('suspended');
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.setState('closed');
    return Promise.resolve();
  }

  advance(seconds: number): void {
    if (this.state === 'running') this.currentTime += seconds;
  }

  sources(): FakeSource[] {
    return this.nodes.filter((node): node is FakeSource => node instanceof FakeSource);
  }

  params(): FakeParam[] {
    return this.nodes.flatMap((node) => Object.values(node).filter((value): value is FakeParam => value instanceof FakeParam));
  }

  reaches(from: FakeNode, to: FakeNode, seen = new Set<FakeNode>()): boolean {
    if (from === to) return true;
    if (seen.has(from)) return false;
    seen.add(from);
    return from.connections.some((target) => target instanceof FakeNode && this.reaches(target, to, seen));
  }

  private setState(state: FakeAudioContext['state']): void {
    if (this.state === state) return;
    this.state = state;
    this.onstatechange?.();
  }
}

export function fakeContext(): { ctx: FakeAudioContext; create: () => AudioContext } {
  const ctx = new FakeAudioContext();
  return { ctx, create: () => ctx as unknown as AudioContext };
}

export function asContext(ctx: FakeAudioContext): BaseAudioContext {
  return ctx as unknown as BaseAudioContext;
}

export function asNode(node: FakeNode): AudioNode {
  return node as unknown as AudioNode;
}

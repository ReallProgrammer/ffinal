export type SystemPhase =
  | 'BOOT'
  | 'BIOS'
  | 'OS_LOADING'
  | 'BOOT_MENU'
  | 'BIOS_SETUP'
  | 'LINUX_TERMINAL'
  | 'WINDOWS_DESKTOP'
  | 'RECOVERY'
  | 'SHUTDOWN'
  | 'OFF'
  | 'BSOD';
export type BootTarget = 'windows' | 'linux';
export interface MachineState {
  phase: SystemPhase;
  target: BootTarget;
  epoch: number;
  safeMode: boolean;
  turnOff: boolean;
}
export type MachineEvent =
  | { type: 'GO'; phase: SystemPhase }
  | { type: 'REBOOT'; target?: BootTarget; turnOff?: boolean }
  | { type: 'POWERED_DOWN' }
  | { type: 'CHOOSE'; target: BootTarget; safe?: boolean }
  | { type: 'LOADED' };
const allowed: Partial<Record<SystemPhase, SystemPhase[]>> = {
  BOOT: ['BIOS', 'BOOT_MENU', 'BIOS_SETUP', 'LINUX_TERMINAL', 'OS_LOADING'],
  BIOS: ['OS_LOADING', 'BOOT_MENU', 'BIOS_SETUP', 'LINUX_TERMINAL'],
  OS_LOADING: ['BOOT_MENU', 'BIOS_SETUP', 'LINUX_TERMINAL'],
  BOOT_MENU: ['BIOS_SETUP', 'RECOVERY', 'BIOS'],
  BIOS_SETUP: ['BOOT_MENU', 'BIOS'],
  RECOVERY: ['BOOT_MENU', 'BIOS_SETUP'],
  WINDOWS_DESKTOP: ['BSOD'],
  BSOD: ['WINDOWS_DESKTOP'],
};
export function machineReducer(state: MachineState, event: MachineEvent): MachineState {
  switch (event.type) {
    case 'GO':
      return allowed[state.phase]?.includes(event.phase) ? { ...state, phase: event.phase } : state;
    case 'REBOOT':
      return {
        ...state,
        phase: 'SHUTDOWN',
        target: event.target || 'windows',
        turnOff: !!event.turnOff,
        safeMode: false,
      };
    case 'POWERED_DOWN':
      return state.phase === 'SHUTDOWN'
        ? { ...state, phase: state.turnOff ? 'OFF' : 'BOOT', epoch: state.epoch + 1 }
        : state;
    case 'CHOOSE':
      return {
        ...state,
        phase: 'BIOS',
        target: event.target,
        safeMode: !!event.safe,
        turnOff: false,
      };
    case 'LOADED':
      return { ...state, phase: state.target === 'linux' ? 'LINUX_TERMINAL' : 'WINDOWS_DESKTOP' };
  }
}

import type { OtlApi } from '@shared/api'

declare global {
  interface Window {
    otl: OtlApi
  }
}

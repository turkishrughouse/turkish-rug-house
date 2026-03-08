"use client"

import { useId } from "react"

export function SelectAllCheckbox() {
  const id = useId()

  return (
    <input
      id={id}
      type="checkbox"
      className="h-4 w-4 rounded border-slate-300"
      aria-label="Select all orders"
      onChange={(event) => {
        const checked = event.currentTarget.checked
        const inputs = document.querySelectorAll<HTMLInputElement>('input[name="orderIds"]')
        inputs.forEach((input) => {
          input.checked = checked
        })
      }}
    />
  )
}


"use client"

import { TopBar } from "./top-bar"
import { MainHeader } from "./main-header"

export function Header() {
    return (
        <header className="relative z-50 flex flex-col">
            <TopBar />
            <MainHeader />
        </header>
    )
}

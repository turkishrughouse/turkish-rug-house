"use client"

import { TopBar } from "./top-bar"
import { MainHeader } from "./main-header"

export function Header() {
    return (
        <header className="sticky top-0 z-[310] flex flex-col bg-white">
            <TopBar />
            <MainHeader />
        </header>
    )
}

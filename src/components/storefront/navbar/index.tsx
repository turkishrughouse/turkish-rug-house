import { getSiteSettings } from "@/lib/site-settings"
import { getPublicCategoryTreeMenu, getPublicMenu, type PublicMenuNode } from "@/lib/storefront/public-menu"
import { BackToTopButton } from "@/components/storefront/back-to-top-button"
import { TopBar } from "./top-bar"
import { MainHeader } from "./main-header"

function isInformationLink(url: string) {
    if (!url || url === "#") return false
    if (/^https?:\/\//i.test(url)) return false
    return !(
        url.startsWith("/product/") ||
        url.startsWith("/category/") ||
        url.startsWith("/basket") ||
        url.startsWith("/checkout") ||
        url.startsWith("/account") ||
        url.startsWith("/compare") ||
        url.startsWith("/wishlist")
    )
}

function filterInformationMenu(nodes: PublicMenuNode[]): PublicMenuNode[] {
    return nodes
        .map((node) => {
            const children = filterInformationMenu(node.children || [])
            const hasValidUrl = isInformationLink(node.url)
            if (!hasValidUrl && children.length === 0) return null
            return {
                ...node,
                url: hasValidUrl ? node.url : children[0]?.url || "#",
                children,
            }
        })
        .filter((node): node is PublicMenuNode => Boolean(node))
}

export async function Header() {
    const [settings, topNavMenu, primaryMenu, headerInfoMenu, footerInfoMenu, categoryTreeMenu] = await Promise.all([
        getSiteSettings(),
        getPublicMenu("TOP_NAV"),
        getPublicMenu("PRIMARY_HEADER"),
        getPublicMenu("HEADER_INFORMATION"),
        getPublicMenu("INFORMATION_FOOTER"),
        getPublicCategoryTreeMenu(),
    ])

    const mobileCategoriesMenu = primaryMenu.length > 0 ? primaryMenu : categoryTreeMenu
    const resolvedInformationMenu = filterInformationMenu(headerInfoMenu.length > 0 ? headerInfoMenu : footerInfoMenu)
    const mobilePagesMenu = resolvedInformationMenu

    return (
        <header className="z-[310] flex flex-col bg-white">
            <TopBar
                items={topNavMenu.map((item) => ({ id: item.id, label: item.label, url: item.url }))}
                language={settings.defaultLanguage}
                currency={settings.defaultCurrency}
            />
            <div className="sticky top-0 z-[310] bg-white">
                <MainHeader
                    initialBrandPrimary={settings.brandPrimary}
                    initialBrandSecondary={settings.brandSecondary}
                    initialMaintenanceMode={settings.maintenanceMode}
                    initialCurrencySettings={{
                        defaultCurrency: settings.defaultCurrency,
                        currencyPosition: settings.currencyPosition,
                        thousandSeparator: settings.thousandSeparator,
                        decimalSeparator: settings.decimalSeparator,
                        numberOfDecimals: settings.numberOfDecimals,
                    }}
                    initialSendPasswordSetupLink={settings.sendPasswordSetupLink}
                    initialMobileCategoriesMenu={mobileCategoriesMenu}
                    initialMobilePagesMenu={mobilePagesMenu}
                    initialInformationMenu={resolvedInformationMenu}
                />
            </div>
            <BackToTopButton />
        </header>
    )
}

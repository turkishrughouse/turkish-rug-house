import { getSiteSettings } from "@/lib/site-settings"
import { getPublicCategoryTreeMenu, getPublicMenu } from "@/lib/storefront/public-menu"
import { TopBar } from "./top-bar"
import { MainHeader } from "./main-header"

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
    const mobilePagesMenu = headerInfoMenu.length > 0 ? headerInfoMenu : footerInfoMenu

    return (
        <header className="sticky top-0 z-[310] flex flex-col bg-white">
            <TopBar
                items={topNavMenu.map((item) => ({ id: item.id, label: item.label, url: item.url }))}
                language={settings.defaultLanguage}
                currency={settings.defaultCurrency}
            />
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
            />
        </header>
    )
}

import "../global.css";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Drawer } from "expo-router/drawer";
import { CartProvider } from "../context/CartContext";
import CustomDrawerContent from "../components/CustomDrawerContent";

export default function RootLayout() {
    return (
        <CartProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
                <Drawer
                    drawerContent={(props) => <CustomDrawerContent {...props} />}
                    screenOptions={{ headerShown: false }}
                >
                    <Drawer.Screen name="(tabs)" options={{ headerShown: false }} />
                    <Drawer.Screen name="product/[slug]" options={{ headerShown: false }} />
                    <Drawer.Screen name="category/[slug]" options={{ headerShown: false }} />
                </Drawer>
            </GestureHandlerRootView>
        </CartProvider>
    );
}

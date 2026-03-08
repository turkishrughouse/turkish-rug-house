
import { Tabs, useNavigation } from "expo-router";
import { Home, Grid, ShoppingBag, User, Menu } from "lucide-react-native";
import { TouchableOpacity, View } from "react-native";
import { DrawerActions } from "@react-navigation/native";

export default function TabLayout() {
    const navigation = useNavigation();
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: "#ffffff",
                    borderTopWidth: 1,
                    borderTopColor: "#f0f0f0",
                    height: 85,
                    paddingBottom: 25,
                    paddingTop: 10,
                },
                tabBarActiveTintColor: "#1a1a1a",
                tabBarInactiveTintColor: "#999999",
                tabBarLabelStyle: {
                    fontSize: 12,
                    fontWeight: "500",
                }
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: "Home",
                    headerShown: true, // Show header for Home to display menu button
                    headerTitle: "",   // Hide title to keep it clean (or put Logo)
                    headerLeft: () => (
                        <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.openDrawer())} style={{ marginLeft: 16 }}>
                            <Menu size={24} color="#1a1a1a" />
                        </TouchableOpacity>
                    ),
                    headerRight: () => (
                        <View style={{ marginRight: 16 }}>
                            {/* Placeholder for future search or notification */}
                        </View>
                    ),
                    tabBarIcon: ({ color }) => <Home size={24} color={color} />,
                }}
            />
            <Tabs.Screen
                name="collections"
                options={{
                    title: "Collections",
                    tabBarIcon: ({ color }) => <Grid size={24} color={color} />,
                }}
            />
            <Tabs.Screen
                name="cart"
                options={{
                    title: "Cart",
                    tabBarIcon: ({ color }) => <ShoppingBag size={24} color={color} />,
                }}
            />
            <Tabs.Screen
                name="account"
                options={{
                    title: "Account",
                    tabBarIcon: ({ color }) => <User size={24} color={color} />,
                }}
            />
        </Tabs>
    );
}

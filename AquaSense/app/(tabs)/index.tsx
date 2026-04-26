import { Redirect, useLocalSearchParams } from "expo-router";

export default function TabsIndex() {
    const { tutorial } = useLocalSearchParams<{ tutorial?: string }>();
    return <Redirect href={tutorial === "1" ? "/home?tutorial=1" : "/home"} />;
}
export class FocusPluginLogger {
    static log(level: 'Debug' | 'Info' | 'Error' , message: string) {
        console.log(`focus-plugin: [${level}] ${message}`);
    }
}
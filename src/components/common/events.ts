import { Gdk, Gtk } from "astal/gtk3";

export const isScrollUp = (event: Gdk.Event): boolean => {
    const [directionSuccess, direction] = event.get_scroll_direction();
    const [deltaSuccess, , yScroll] = event.get_scroll_deltas();

    if (directionSuccess && direction === Gdk.ScrollDirection.UP) {
        return true;
    }

    if (deltaSuccess && yScroll < 0) {
        return true;
    }

    return false;
};

export const isScrollDown = (event: Gdk.Event): boolean => {
    const [directionSuccess, direction] = event.get_scroll_direction();
    const [deltaSuccess, , yScroll] = event.get_scroll_deltas();

    if (directionSuccess && direction === Gdk.ScrollDirection.DOWN) {
        return true;
    }

    if (deltaSuccess && yScroll > 0) {
        return true;
    }

    return false;
};

export class MouseEvents {
    public static onPrimaryHandler<Target extends InstanceType<typeof Gtk.Widget>>(
        handler: (target: Target, event: Gdk.Event) => void
    ): (target: Target, event: Gdk.Event) => void {
        return (target: Target, event: Gdk.Event): void => {
            this.onPrimary(target, event, handler);
        };
    }

    public static onSecondaryHandler<Target extends InstanceType<typeof Gtk.Widget>>(
        handler: (target: Target, event: Gdk.Event) => void
    ): (target: Target, event: Gdk.Event) => void {
        return (target: Target, event: Gdk.Event): void => {
            this.onSecondary(target, event, handler);
        };
    }

    public static onClickHandler<Target extends InstanceType<typeof Gtk.Widget>>(
        buttonCode: number,
        handler: (target: Target, event: Gdk.Event) => void
    ): (target: Target, event: Gdk.Event) => void {
        return (target: Target, event: Gdk.Event): void => {
            this.onClick(target, event, buttonCode, handler);
        };
    }

    public static onPrimary<Target extends InstanceType<typeof Gtk.Widget>>(
        target: Target,
        event: Gdk.Event,
        handler: (target: Target, event: Gdk.Event) => void
    ): void {
        this.onClick(target, event, Gdk.BUTTON_PRIMARY, handler);
    }

    public static onSecondary<Target extends InstanceType<typeof Gtk.Widget>>(
        target: Target,
        event: Gdk.Event,
        handler: (target: Target, event: Gdk.Event) => void
    ): void {
        this.onClick(target, event, Gdk.BUTTON_SECONDARY, handler);
    }

    public static onClick<Target extends InstanceType<typeof Gtk.Widget>>(
        target: Target,
        event: Gdk.Event,
        buttonCode: number,
        handler: (target: Target, event: Gdk.Event) => void
    ): void {
        const [isButton, button] = event.get_button();
        if (isButton && button === buttonCode) {
            handler(target, event);
        }
    }
}

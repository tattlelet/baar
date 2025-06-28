import { GObject } from "astal";
import { astalify, Gtk, ConstructProps } from "astal/gtk3";

export class Menu extends astalify(Gtk.Menu) {
    static {
        GObject.registerClass(this);
    }

    constructor(props: ConstructProps<Menu, Gtk.Menu.ConstructorProps>) {
        super(props as any);
    }
}

export class MenuItem extends astalify(Gtk.MenuItem) {
    static {
        GObject.registerClass(this);
    }

    constructor(props: ConstructProps<MenuItem, Gtk.MenuItem.ConstructorProps>) {
        super(props as any);
    }
}

export class Calendar extends astalify(Gtk.Calendar) {
    static {
        GObject.registerClass(this);
    }

    constructor(props: ConstructProps<Calendar, Gtk.Calendar.ConstructorProps>) {
        super(props as any);
    }
}

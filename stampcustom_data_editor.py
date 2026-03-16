from __future__ import annotations

import json
import shutil
import tkinter as tk
from pathlib import Path
from tkinter import messagebox, ttk


ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "stampcustomdata"
JSON_PATH = DATA_DIR / "stamps.json"
JS_PATH = DATA_DIR / "stamps-data.js"


class StampEditorApp:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title("Stamp Custom Data Editor")
        self.root.geometry("1280x780")
        self.root.minsize(1160, 700)

        self.data = self.load_data()
        self.filtered_keys: list[tuple[str, int]] = []
        self.current_key: tuple[str, int] | None = None

        self.search_var = tk.StringVar()
        self.category_var = tk.StringVar(value="all")
        self.status_var = tk.StringVar(value="Ready")

        self.model_var = tk.StringVar()
        self.article_var = tk.StringVar()
        self.group_var = tk.StringVar(value="pre-inked")
        self.shape_var = tk.StringVar(value="rect")
        self.width_var = tk.StringVar()
        self.height_var = tk.StringVar()
        self.diameter_var = tk.StringVar()
        self.price_var = tk.StringVar()
        self.size_label_var = tk.StringVar()
        self.description_var = tk.StringVar()
        self.linked_models_var = tk.StringVar()

        self.field_widgets: dict[str, ttk.Entry | ttk.Combobox] = {}
        self.field_rows: dict[str, ttk.Label] = {}

        self.build_ui()
        self.refresh_tree()

    def load_data(self) -> dict:
        if not JSON_PATH.exists():
            raise FileNotFoundError(f"Missing data file: {JSON_PATH}")
        return json.loads(JSON_PATH.read_text(encoding="utf-8"))

    def build_ui(self) -> None:
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(1, weight=1)

        top_bar = ttk.Frame(self.root, padding=(14, 12))
        top_bar.grid(row=0, column=0, sticky="ew")
        top_bar.columnconfigure(1, weight=1)

        ttk.Label(top_bar, text="Search").grid(row=0, column=0, sticky="w")
        search_entry = ttk.Entry(top_bar, textvariable=self.search_var)
        search_entry.grid(row=0, column=1, sticky="ew", padx=(10, 12))
        search_entry.bind("<KeyRelease>", lambda _event: self.refresh_tree())

        ttk.Label(top_bar, text="Category").grid(row=0, column=2, sticky="w", padx=(0, 8))
        category_box = ttk.Combobox(
            top_bar,
            textvariable=self.category_var,
            values=("all", "stamp", "rubber", "ink"),
            state="readonly",
            width=12,
        )
        category_box.grid(row=0, column=3, sticky="w", padx=(0, 12))
        category_box.bind("<<ComboboxSelected>>", lambda _event: self.refresh_tree())

        ttk.Button(top_bar, text="Refresh", command=self.reload_from_disk).grid(row=0, column=4, padx=(0, 8))
        ttk.Button(top_bar, text="Save All", command=self.save_all).grid(row=0, column=5)

        main = ttk.Panedwindow(self.root, orient=tk.HORIZONTAL)
        main.grid(row=1, column=0, sticky="nsew", padx=14, pady=(0, 10))

        left = ttk.Frame(main, padding=10)
        right = ttk.Frame(main, padding=14)
        main.add(left, weight=3)
        main.add(right, weight=2)

        left.columnconfigure(0, weight=1)
        left.rowconfigure(1, weight=1)
        right.columnconfigure(1, weight=1)

        ttk.Label(left, text="Items").grid(row=0, column=0, sticky="w", pady=(0, 8))

        columns = ("type", "model", "article", "details", "price")
        self.tree = ttk.Treeview(left, columns=columns, show="headings", height=26)
        self.tree.heading("type", text="Type")
        self.tree.heading("model", text="Series / Model")
        self.tree.heading("article", text="Article No")
        self.tree.heading("details", text="Size / Link")
        self.tree.heading("price", text="Selling Price")
        self.tree.column("type", width=90, anchor="center")
        self.tree.column("model", width=110, anchor="center")
        self.tree.column("article", width=180, anchor="w")
        self.tree.column("details", width=180, anchor="center")
        self.tree.column("price", width=110, anchor="e")
        self.tree.grid(row=1, column=0, sticky="nsew")
        self.tree.bind("<<TreeviewSelect>>", self.on_tree_select)

        tree_scroll = ttk.Scrollbar(left, orient="vertical", command=self.tree.yview)
        tree_scroll.grid(row=1, column=1, sticky="ns")
        self.tree.configure(yscrollcommand=tree_scroll.set)

        ttk.Label(right, text="Item details").grid(row=0, column=0, sticky="w", pady=(0, 10))

        row = 1
        self.add_field(right, row, "Series / model", "model", self.model_var)
        row += 1
        self.add_field(right, row, "Article no.", "article", self.article_var)
        row += 1

        self.add_combo_field(right, row, "Type", "group", self.group_var, ("pre-inked", "rubber", "ink"))
        row += 1
        self.add_combo_field(right, row, "Shape", "shape", self.shape_var, ("rect", "circle"))
        row += 1

        self.add_field(right, row, "Width (mm)", "width", self.width_var)
        row += 1
        self.add_field(right, row, "Height (mm)", "height", self.height_var)
        row += 1
        self.add_field(right, row, "Diameter (mm)", "diameter", self.diameter_var)
        row += 1
        self.add_field(right, row, "Selling price (RM)", "price", self.price_var)
        row += 1
        self.add_field(right, row, "Size label", "size_label", self.size_label_var)
        row += 1
        self.add_field(right, row, "Description", "description", self.description_var)
        row += 1
        self.add_field(right, row, "Linked models", "linked_models", self.linked_models_var)
        row += 1

        helper = (
            "Tips:\n"
            "- Stamp: edit shape, size, series, price\n"
            "- Rubber: edit linked models, price, description\n"
            "- Ink: linked models can stay as all\n"
            "- Save updates stamps.json and stamps-data.js together"
        )
        ttk.Label(right, text=helper, justify="left").grid(row=row, column=0, columnspan=2, sticky="w", pady=(12, 14))
        row += 1

        action_bar = ttk.Frame(right)
        action_bar.grid(row=row, column=0, columnspan=2, sticky="ew")
        ttk.Button(action_bar, text="Apply To Selected", command=self.apply_to_selected).pack(side="left")
        ttk.Button(action_bar, text="Auto Build Text", command=self.auto_fill_fields).pack(side="left", padx=(8, 0))
        ttk.Button(action_bar, text="Save All", command=self.save_all).pack(side="right")

        status_bar = ttk.Label(self.root, textvariable=self.status_var, anchor="w", relief="sunken", padding=(10, 6))
        status_bar.grid(row=2, column=0, sticky="ew")

        self.field_widgets["group"].bind("<<ComboboxSelected>>", lambda _event: self.update_editor_visibility())
        self.field_widgets["shape"].bind("<<ComboboxSelected>>", lambda _event: self.update_editor_visibility())

    def add_field(self, parent: ttk.Frame, row: int, label_text: str, key: str, variable: tk.StringVar) -> None:
        label = ttk.Label(parent, text=label_text)
        label.grid(row=row, column=0, sticky="w", pady=6)
        entry = ttk.Entry(parent, textvariable=variable)
        entry.grid(row=row, column=1, sticky="ew", pady=6)
        self.field_rows[key] = label
        self.field_widgets[key] = entry

    def add_combo_field(
        self,
        parent: ttk.Frame,
        row: int,
        label_text: str,
        key: str,
        variable: tk.StringVar,
        values: tuple[str, ...],
    ) -> None:
        label = ttk.Label(parent, text=label_text)
        label.grid(row=row, column=0, sticky="w", pady=6)
        combo = ttk.Combobox(parent, textvariable=variable, values=values, state="readonly")
        combo.grid(row=row, column=1, sticky="ew", pady=6)
        self.field_rows[key] = label
        self.field_widgets[key] = combo

    def refresh_tree(self) -> None:
        search = self.search_var.get().strip().lower()
        selected_key = self.current_key

        for item_id in self.tree.get_children():
            self.tree.delete(item_id)

        self.filtered_keys = []
        for kind, index, item in self.iter_all_items():
            if not self.matches_category(kind):
                continue

            haystack = " ".join(
                [
                    kind,
                    item.get("model", ""),
                    item.get("articleNo", ""),
                    item.get("shape", ""),
                    item.get("sizeLabel", ""),
                    item.get("description", ""),
                    item.get("productGroup", ""),
                    str(item.get("linkedModels", "")),
                    str(item.get("rsp", "")),
                ]
            ).lower()
            if search and search not in haystack:
                continue

            key = (kind, index)
            self.filtered_keys.append(key)
            self.tree.insert(
                "",
                "end",
                iid=self.key_to_id(key),
                values=(
                    self.kind_label(kind),
                    item.get("model", ""),
                    item.get("articleNo", ""),
                    self.detail_label(kind, item),
                    f"{float(item.get('rsp', 0)):.2f}",
                ),
            )

        if self.filtered_keys:
            next_key = selected_key if selected_key in self.filtered_keys else self.filtered_keys[0]
            self.select_key(next_key)
        else:
            self.current_key = None
            self.clear_editor()
            self.status_var.set("No matching items found.")

    def iter_all_items(self):
        for index, item in enumerate(self.data.get("stamps", [])):
            yield "stamp", index, item
        for index, item in enumerate(self.data.get("accessories", [])):
            kind = item.get("productGroup", "accessory")
            yield kind, index, item

    def matches_category(self, kind: str) -> bool:
        selected = self.category_var.get()
        return selected == "all" or selected == kind

    @staticmethod
    def key_to_id(key: tuple[str, int]) -> str:
        return f"{key[0]}:{key[1]}"

    @staticmethod
    def id_to_key(value: str) -> tuple[str, int]:
        kind, index = value.split(":", 1)
        return kind, int(index)

    @staticmethod
    def kind_label(kind: str) -> str:
        return {
            "stamp": "Stamp",
            "rubber": "Rubber",
            "ink": "Ink",
        }.get(kind, kind.title())

    def detail_label(self, kind: str, item: dict) -> str:
        if kind == "stamp":
            return item.get("sizeLabel", "")
        linked = item.get("linkedModels", "")
        if linked == "all":
            return "All stamps"
        if isinstance(linked, list):
            return ", ".join(linked)
        return str(linked)

    def clear_editor(self) -> None:
        for var in (
            self.model_var,
            self.article_var,
            self.width_var,
            self.height_var,
            self.diameter_var,
            self.price_var,
            self.size_label_var,
            self.description_var,
            self.linked_models_var,
        ):
            var.set("")
        self.group_var.set("pre-inked")
        self.shape_var.set("rect")
        self.update_editor_visibility()

    def select_key(self, key: tuple[str, int]) -> None:
        self.current_key = key
        item_id = self.key_to_id(key)
        if item_id in self.tree.get_children():
            self.tree.selection_set(item_id)
            self.tree.focus(item_id)
            self.tree.see(item_id)
        self.load_editor_from_item(key)

    def load_editor_from_item(self, key: tuple[str, int]) -> None:
        kind, index = key
        item = self.get_item(kind, index)
        self.model_var.set(item.get("model", ""))
        self.article_var.set(item.get("articleNo", ""))
        self.group_var.set(item.get("productGroup", "pre-inked"))
        self.shape_var.set(item.get("shape", "rect"))
        self.width_var.set("" if item.get("widthMm") is None else str(item.get("widthMm")))
        self.height_var.set("" if item.get("heightMm") is None else str(item.get("heightMm")))
        self.diameter_var.set("" if item.get("diameterMm") is None else str(item.get("diameterMm")))
        self.price_var.set(str(item.get("rsp", "")))
        self.size_label_var.set(item.get("sizeLabel", ""))
        self.description_var.set(item.get("description", ""))

        linked_models = item.get("linkedModels", "")
        if linked_models == "all":
            self.linked_models_var.set("all")
        elif isinstance(linked_models, list):
            self.linked_models_var.set(", ".join(linked_models))
        else:
            self.linked_models_var.set(str(linked_models))

        self.update_editor_visibility()
        self.status_var.set(f"Editing {self.kind_label(kind)} {item.get('model', '')} ({item.get('articleNo', '')})")

    def get_item(self, kind: str, index: int) -> dict:
        if kind == "stamp":
            return self.data["stamps"][index]
        return self.data["accessories"][index]

    def on_tree_select(self, _event: object) -> None:
        selection = self.tree.selection()
        if not selection:
            return
        self.current_key = self.id_to_key(selection[0])
        self.load_editor_from_item(self.current_key)

    def update_editor_visibility(self) -> None:
        group = self.group_var.get()
        is_stamp = group == "pre-inked"
        is_circle = self.shape_var.get() == "circle"

        self.toggle_field("shape", is_stamp)
        self.toggle_field("width", is_stamp and not is_circle)
        self.toggle_field("height", is_stamp and not is_circle)
        self.toggle_field("diameter", is_stamp and is_circle)
        self.toggle_field("size_label", is_stamp)
        self.toggle_field("linked_models", not is_stamp)

    def toggle_field(self, key: str, visible: bool) -> None:
        label = self.field_rows[key]
        widget = self.field_widgets[key]
        if visible:
            label.grid()
            widget.grid()
        else:
            label.grid_remove()
            widget.grid_remove()

    def auto_fill_fields(self) -> None:
        group = self.group_var.get()
        model = self.model_var.get().strip()

        if group == "pre-inked":
            if self.shape_var.get() == "circle":
                diameter = self.parse_float(self.diameter_var.get(), "Diameter")
                self.size_label_var.set(f"{self.trim_float(diameter)} mm diameter")
                self.description_var.set(f"Xstamper Quix Pre-Inked Stamp {model} ({self.trim_float(diameter)}mm diameter)")
            else:
                width = self.parse_float(self.width_var.get(), "Width")
                height = self.parse_float(self.height_var.get(), "Height")
                self.size_label_var.set(f"{self.trim_float(width)} x {self.trim_float(height)} mm")
                self.description_var.set(
                    f"Xstamper Quix Pre-Inked Stamp {model} ({self.trim_float(width)} X {self.trim_float(height)}mm)"
                )
        elif group == "rubber":
            self.description_var.set(f"Xstamper Quix Rubber ({model})")
        elif group == "ink" and not self.description_var.get().strip():
            article = self.article_var.get().strip()
            self.description_var.set(f"{article} Xstamper Quix Ink {model}")

        self.status_var.set("Text fields rebuilt from the current values.")

    def apply_to_selected(self) -> None:
        if self.current_key is None:
            messagebox.showwarning("No item selected", "Please select a stamp, rubber, or ink item first.")
            return

        try:
            kind, index = self.current_key
            updated_item = self.build_updated_item(kind, self.get_item(kind, index))
            if kind == "stamp":
                self.data["stamps"][index] = updated_item
            else:
                self.data["accessories"][index] = updated_item
        except ValueError as error:
            messagebox.showerror("Invalid value", str(error))
            return

        self.refresh_tree()
        self.select_key(self.current_key)
        self.status_var.set("Updated in memory. Click Save All to write the files.")

    def build_updated_item(self, kind: str, existing: dict) -> dict:
        group = self.group_var.get().strip() or existing.get("productGroup", "pre-inked")
        article = self.require_text(self.article_var.get(), "Article no.")
        model = self.require_text(self.model_var.get(), "Series / model")
        price = round(self.parse_float(self.price_var.get(), "Selling price"), 2)
        description = self.require_text(self.description_var.get(), "Description")

        updated = dict(existing)
        updated.update(
            {
                "articleNo": article,
                "model": model,
                "productGroup": group,
                "rsp": price,
                "description": description,
            }
        )

        if kind == "stamp":
            shape = self.shape_var.get().strip() or "rect"
            updated["shape"] = shape
            if shape == "circle":
                diameter = self.parse_float(self.diameter_var.get(), "Diameter")
                updated["widthMm"] = None
                updated["heightMm"] = None
                updated["diameterMm"] = diameter
                updated["sizeLabel"] = self.require_text(
                    self.size_label_var.get() or f"{self.trim_float(diameter)} mm diameter",
                    "Size label",
                )
            else:
                width = self.parse_float(self.width_var.get(), "Width")
                height = self.parse_float(self.height_var.get(), "Height")
                updated["widthMm"] = width
                updated["heightMm"] = height
                updated["diameterMm"] = None
                updated["sizeLabel"] = self.require_text(
                    self.size_label_var.get() or f"{self.trim_float(width)} x {self.trim_float(height)} mm",
                    "Size label",
                )
        else:
            linked_value = self.linked_models_var.get().strip()
            if group == "ink" and linked_value.lower() in {"", "all"}:
                updated["linkedModels"] = "all"
            else:
                linked_models = [value.strip() for value in linked_value.split(",") if value.strip()]
                updated["linkedModels"] = linked_models

        return updated

    def save_all(self) -> None:
        try:
            if self.current_key is not None:
                self.apply_to_selected()

            self.make_backup(JSON_PATH)
            self.make_backup(JS_PATH)
            json_text = json.dumps(self.data, indent=2, ensure_ascii=False) + "\n"
            JSON_PATH.write_text(json_text, encoding="utf-8")
            JS_PATH.write_text("window.APP_DATA = " + json_text + ";\n", encoding="utf-8")
        except ValueError as error:
            messagebox.showerror("Invalid value", str(error))
            return
        except OSError as error:
            messagebox.showerror("Save failed", f"Could not save files:\n{error}")
            return

        self.status_var.set("Saved stampcustomdata/stamps.json and stampcustomdata/stamps-data.js")
        messagebox.showinfo("Saved", "All stamp and accessory data saved successfully.")

    def reload_from_disk(self) -> None:
        self.data = self.load_data()
        self.current_key = None
        self.refresh_tree()
        self.status_var.set("Reloaded latest data from disk.")

    @staticmethod
    def make_backup(path: Path) -> None:
        if path.exists():
            shutil.copy2(path, path.with_suffix(path.suffix + ".bak"))

    @staticmethod
    def require_text(value: str, field_name: str) -> str:
        clean = value.strip()
        if not clean:
            raise ValueError(f"{field_name} is required.")
        return clean

    @staticmethod
    def parse_float(value: str, field_name: str) -> float:
        clean = value.strip()
        if not clean:
            raise ValueError(f"{field_name} is required.")
        try:
            return float(clean)
        except ValueError as error:
            raise ValueError(f"{field_name} must be a number.") from error

    @staticmethod
    def trim_float(value: float) -> str:
        text = f"{value:.4f}".rstrip("0").rstrip(".")
        return text or "0"


def main() -> None:
    root = tk.Tk()
    try:
        StampEditorApp(root)
    except Exception as error:  # pragma: no cover
        messagebox.showerror("Startup error", str(error))
        return
    root.mainloop()


if __name__ == "__main__":
    main()

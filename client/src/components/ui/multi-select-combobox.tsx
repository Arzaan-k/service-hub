import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"

interface MultiSelectComboboxOption {
    value: string
    label: string
}

interface MultiSelectComboboxProps {
    options: MultiSelectComboboxOption[]
    selectedValues: string[]
    onSelectedValuesChange: (values: string[]) => void
    placeholder?: string
    searchPlaceholder?: string
    emptyText?: string
    className?: string
}

export function MultiSelectCombobox({
    options,
    selectedValues,
    onSelectedValuesChange,
    placeholder = "Select options...",
    searchPlaceholder = "Search...",
    emptyText = "No results found.",
    className,
}: MultiSelectComboboxProps) {
    const [open, setOpen] = React.useState(false)

    const handleSelect = (value: string) => {
        if (selectedValues.includes(value)) {
            onSelectedValuesChange(selectedValues.filter((v) => v !== value))
        } else {
            onSelectedValuesChange([...selectedValues, value])
        }
    }

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation()
        onSelectedValuesChange([])
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between h-auto min-h-10", className)}
                >
                    <div className="flex flex-wrap gap-1 items-center">
                        {selectedValues.length > 0 ? (
                            selectedValues.length > 2 ? (
                                <Badge variant="secondary" className="mr-1">
                                    {selectedValues.length} selected
                                </Badge>
                            ) : (
                                options
                                    .filter((option) => selectedValues.includes(option.value))
                                    .map((option) => (
                                        <Badge key={option.value} variant="secondary" className="mr-1">
                                            {option.label}
                                        </Badge>
                                    ))
                            )
                        ) : (
                            <span className="text-muted-foreground">{placeholder}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        {selectedValues.length > 0 && (
                            <X
                                className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100 cursor-pointer"
                                onClick={handleClear}
                            />
                        )}
                        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                    </div>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
                <Command>
                    <CommandInput placeholder={searchPlaceholder} />
                    <CommandEmpty>{emptyText}</CommandEmpty>
                    <CommandGroup className="max-h-64 overflow-auto">
                        {options.map((option) => (
                            <CommandItem
                                key={option.value}
                                value={option.label}
                                onSelect={() => handleSelect(option.value)}
                            >
                                <Check
                                    className={cn(
                                        "mr-2 h-4 w-4",
                                        selectedValues.includes(option.value)
                                            ? "opacity-100"
                                            : "opacity-0"
                                    )}
                                />
                                {option.label}
                            </CommandItem>
                        ))}
                    </CommandGroup>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

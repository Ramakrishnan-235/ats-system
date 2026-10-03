"""Copy validation input and resolve declared aliases before normalizing values."""

from typing import Any

from pydantic import AliasChoices, BaseModel


def normalization_input(model: type[BaseModel], data: Any) -> Any:
    """Honor Pydantic alias precedence without modifying the caller's mapping."""
    if not isinstance(data, dict):
        return data

    result = dict(data)
    for name, field in model.model_fields.items():
        alias = field.validation_alias
        choices = alias.choices if isinstance(alias, AliasChoices) else [alias or name]
        for choice in choices:
            if isinstance(choice, str) and choice in data:
                result[name] = data[choice]
                break
    return result

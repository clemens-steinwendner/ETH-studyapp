import pytest
from app.sandbox.languages import get_config, LANGUAGE_REGISTRY


def test_all_registered_languages_have_valid_config() -> None:
    for lang in ["python", "sql", "haskell"]:
        config = get_config(lang)
        assert config.language_id == lang
        assert config.runner_template.endswith(".j2")


def test_unknown_language_raises() -> None:
    with pytest.raises(ValueError, match="Unsupported language"):
        get_config("ruby")

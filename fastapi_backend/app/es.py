from elasticsearch import AsyncElasticsearch

from app.config import settings

_client: AsyncElasticsearch | None = None


def get_es() -> AsyncElasticsearch:
    global _client
    if _client is None:
        _client = AsyncElasticsearch(
            hosts=[settings.ELASTICSEARCH_URL],
            request_timeout=settings.ES_REQUEST_TIMEOUT,
        )
    return _client

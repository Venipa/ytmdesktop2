type JsonLdProps = {
  data: Record<string, unknown>;
};

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script type="application/ld+json">{JSON.stringify(data).replace(/</g, "\\u003c")}</script>
  );
}

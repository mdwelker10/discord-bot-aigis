# This script creates an intermediate certificate from a domain and attaches it to the main certificate
# Usage: ./pem.sh <domain>
# ex: ./pem.sh mangaplus.shueisha.co.jp
# Do not include the pem extension in the filename
domain="$1"

if [ -z "$domain" ]; then
  echo "Usage: ./pem.sh <domain>"
  exit 1
fi

openssl s_client -connect $domain:443 -servername $domain.com | tee logcertfile
uri=$(openssl x509 -in logcertfile -noout -text | grep -i "CA Issuers - URI:" | awk -F 'URI:' '{print $2}' | sed 's/^[[:space:]]*//')
curl --output temp.crt $uri
openssl x509 -inform DER -in temp.crt -out temp.pem -text
cat temp.pem >>main.pem
rm temp.crt logcertfile temp.pem
echo "Certificate created successfully"

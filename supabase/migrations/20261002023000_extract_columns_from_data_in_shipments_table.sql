ALTER TABLE IF EXISTS public.shipments
    ALTER COLUMN shipment_status DROP DEFAULT;

ALTER TABLE IF EXISTS public.shipments
    ADD COLUMN shipping_type text;

ALTER TABLE IF EXISTS public.shipments
    ADD COLUMN shipping_source text;

ALTER TABLE IF EXISTS public.shipments
    ADD COLUMN shipping_destination text;

ALTER TABLE IF EXISTS public.shipments
    ADD COLUMN shipping_date timestamp with time zone;

ALTER TABLE IF EXISTS public.shipments
    ADD COLUMN shipping_duration numeric;

ALTER TABLE IF EXISTS public.shipments
    ADD COLUMN expected_arrival timestamp with time zone;

ALTER TABLE IF EXISTS public.shipments
    ADD COLUMN delivery_date timestamp with time zone;

ALTER TABLE IF EXISTS public.shipments
    ADD COLUMN packaging_fees numeric;

ALTER TABLE IF EXISTS public.shipments
    ADD COLUMN shipping_category_price numeric;





ALTER TABLE IF EXISTS public.shipping_companies
    ADD COLUMN address text;
ALTER TABLE IF EXISTS public.shipping_companies 
    ADD COLUMN is_active boolean;



ALTER TABLE IF EXISTS public.sources 
    ADD COLUMN is_active boolean;


ALTER TABLE IF EXISTS public.portal_users DROP COLUMN IF EXISTS account_id;

ALTER TABLE IF EXISTS public.portal_users
    ADD COLUMN type text;
ALTER TABLE IF EXISTS public.portal_users
    ADD COLUMN phone text;
ALTER TABLE IF EXISTS public.portal_users
    ADD COLUMN notes text;
ALTER TABLE IF EXISTS public.portal_users
    ADD COLUMN profile_image_url text;
ALTER TABLE IF EXISTS public.portal_users
    ADD COLUMN commercial_register_url text;
ALTER TABLE IF EXISTS public.portal_users
    ADD COLUMN identity_doc_url text;
ALTER TABLE IF EXISTS public.portal_users
    ADD COLUMN onboarding_completed boolean;
ALTER TABLE IF EXISTS public.portal_users
    ADD COLUMN password text;

ALTER TABLE IF EXISTS public.auto_entries
    ADD COLUMN auto_post boolean;
ALTER TABLE IF EXISTS public.auto_entries
    ADD COLUMN credit_account text;
ALTER TABLE IF EXISTS public.auto_entries	
    ADD COLUMN debit_account text;	
ALTER TABLE IF EXISTS public.auto_entries	
    ADD COLUMN description_temp_ar text;	
ALTER TABLE IF EXISTS public.auto_entries	
    ADD COLUMN description_temp_en text;	
ALTER TABLE IF EXISTS public.auto_entries	
    ADD COLUMN status_name_ar text;		


ALTER TABLE IF EXISTS public.browser_pages
    ADD COLUMN auto_login boolean;
ALTER TABLE IF EXISTS public.browser_pages
    ADD COLUMN username text;    
ALTER TABLE IF EXISTS public.browser_pages
    ADD COLUMN password text;    
ALTER TABLE IF EXISTS public.browser_pages
    ADD COLUMN category text;
ALTER TABLE IF EXISTS public.browser_pages
    ADD COLUMN is_pinned boolean;
ALTER TABLE IF EXISTS public.browser_pages
    ADD COLUMN name_ar text;
ALTER TABLE IF EXISTS public.browser_pages
    ADD COLUMN name_en text;
ALTER TABLE IF EXISTS public.browser_pages
    ADD COLUMN sort_order integer;
ALTER TABLE IF EXISTS public.browser_pages
    ADD COLUMN tab_color text;
ALTER TABLE IF EXISTS public.browser_pages
    ADD COLUMN url text;
ALTER TABLE IF EXISTS public.browser_pages
    ADD COLUMN view_mode text;



ALTER TABLE IF EXISTS public.cust_details
    ADD COLUMN age int;
ALTER TABLE IF EXISTS public.cust_details
    ADD COLUMN body_details text;
ALTER TABLE IF EXISTS public.cust_details
    ADD COLUMN city text;
ALTER TABLE IF EXISTS public.cust_details
    ADD COLUMN company_name text;
ALTER TABLE IF EXISTS public.cust_details
    ADD COLUMN country text;
ALTER TABLE IF EXISTS public.cust_details
    ADD COLUMN gender text;
ALTER TABLE IF EXISTS public.cust_details
    ADD COLUMN gps_location text;
ALTER TABLE IF EXISTS public.cust_details
    ADD COLUMN id_number text;
ALTER TABLE IF EXISTS public.cust_details
    ADD COLUMN max_debt numeric;
ALTER TABLE IF EXISTS public.cust_details
    ADD COLUMN notes text;
ALTER TABLE IF EXISTS public.cust_details
    ADD COLUMN privacy_policy_agreed boolean;
ALTER TABLE IF EXISTS public.cust_details
    ADD COLUMN privacy_policy_agreed_at timestamp with time zone;
ALTER TABLE IF EXISTS public.customers
    ADD COLUMN acquisition_source text;
ALTER TABLE IF EXISTS public.customers
    ADD COLUMN preferred_categories jsonb;
ALTER TABLE IF EXISTS public.customers
    ADD COLUMN body_details jsonb;
ALTER TABLE IF EXISTS public.customers
    ADD COLUMN location jsonb;
ALTER TABLE IF EXISTS public.customers
    ADD COLUMN address text;


ALTER TABLE IF EXISTS jobs_req 
    ADD COLUMN address text;
ALTER TABLE IF EXISTS jobs_req 
    ADD COLUMN city text;   
ALTER TABLE IF EXISTS jobs_req 
    ADD COLUMN email text; 
ALTER TABLE IF EXISTS jobs_req 
    ADD COLUMN experience_years integer;  
ALTER TABLE IF EXISTS jobs_req 
    ADD COLUMN full_name text;
ALTER TABLE IF EXISTS jobs_req 
    ADD COLUMN id_number text;
ALTER TABLE IF EXISTS jobs_req 
    ADD COLUMN job_position text;   
ALTER TABLE IF EXISTS jobs_req 
    ADD COLUMN notes text;    
ALTER TABLE IF EXISTS jobs_req 
    ADD COLUMN phone text;    
ALTER TABLE IF EXISTS jobs_req 
    ADD COLUMN qualification text;
ALTER TABLE IF EXISTS jobs_req 
    ADD COLUMN ref_code text;    
ALTER TABLE IF EXISTS jobs_req 
    ADD COLUMN status text;



ALTER TABLE IF EXISTS notifications 
    ADD COLUMN associated_user_ids jsonb;
ALTER TABLE IF EXISTS notifications 
    ADD COLUMN category text;
ALTER TABLE IF EXISTS notifications 
    ADD COLUMN creator_id text;
ALTER TABLE IF EXISTS notifications 
    ADD COLUMN creator_name text;
ALTER TABLE IF EXISTS notifications 
    ADD COLUMN is_public boolean;
ALTER TABLE IF EXISTS notifications 
    ADD COLUMN message text;
ALTER TABLE IF EXISTS notifications 
    ADD COLUMN is_read boolean;
ALTER TABLE IF EXISTS notifications 
    ADD COLUMN title text;
ALTER TABLE IF EXISTS notifications 
    ADD COLUMN type text;  


ALTER TABLE IF EXISTS order_status
    ADD COLUMN description text;


ALTER TABLE IF EXISTS portal_tickets
    ADD COLUMN message text;
ALTER TABLE IF EXISTS portal_tickets
    ADD COLUMN replies jsonb;
ALTER TABLE IF EXISTS portal_tickets
    ADD COLUMN status text;
ALTER TABLE IF EXISTS portal_tickets
    ADD COLUMN subject text;
ALTER TABLE IF EXISTS portal_tickets
    ADD COLUMN type text;    


ALTER TABLE IF EXISTS salary_history
    ADD COLUMN employee_id text;
ALTER TABLE IF EXISTS salary_history
    ADD COLUMN notes text;
ALTER TABLE IF EXISTS salary_history
    ADD COLUMN paid_at timestamp with time zone;
ALTER TABLE IF EXISTS salary_history
    ADD COLUMN status text;
ALTER TABLE IF EXISTS salary_history
    ADD COLUMN voucher_code text;



 ALTER TABLE IF EXISTS user_settings
    ADD COLUMN dashboard_grid_columns numeric;
ALTER TABLE IF EXISTS user_settings
    ADD COLUMN font_size text;
ALTER TABLE IF EXISTS user_settings
    ADD COLUMN language text;
ALTER TABLE IF EXISTS user_settings
    ADD COLUMN theme text;
ALTER TABLE IF EXISTS user_settings
    ADD COLUMN visible_metrics jsonb;



 ALTER TABLE IF EXISTS whatsapp_logs
    ADD COLUMN error_msg text;
ALTER TABLE IF EXISTS whatsapp_logs
    ADD COLUMN event_type text;
ALTER TABLE IF EXISTS whatsapp_logs
    ADD COLUMN external_response jsonb;
ALTER TABLE IF EXISTS whatsapp_logs
    ADD COLUMN message text;
ALTER TABLE IF EXISTS whatsapp_logs
    ADD COLUMN message_type text;    
ALTER TABLE IF EXISTS whatsapp_logs
    ADD COLUMN phone text;
ALTER TABLE IF EXISTS whatsapp_logs
    ADD COLUMN status text;



 ALTER TABLE IF EXISTS sessions
    ADD COLUMN ip_address text;
ALTER TABLE IF EXISTS sessions
    ADD COLUMN user_agent text;
ALTER TABLE IF EXISTS sessions
    ADD COLUMN login_at timestamp with time zone;
ALTER TABLE IF EXISTS sessions
    ADD COLUMN expires_at timestamp with time zone;










ALTER TABLE IF EXISTS report_templates
    ADD COLUMN active_report boolean;
ALTER TABLE IF EXISTS report_templates
    ADD COLUMN filters jsonb;
ALTER TABLE IF EXISTS report_templates
    ADD COLUMN name_ar text;
ALTER TABLE IF EXISTS report_templates
    ADD COLUMN name_en text;
ALTER TABLE IF EXISTS report_templates
    ADD COLUMN search_term text;
ALTER TABLE IF EXISTS report_templates
    ADD COLUMN selected_company_id text;
ALTER TABLE IF EXISTS report_templates
    ADD COLUMN selected_courier_id text;
ALTER TABLE IF EXISTS report_templates
    ADD COLUMN selected_customer_id text;
ALTER TABLE IF EXISTS report_templates
    ADD COLUMN selected_expense_category text;
ALTER TABLE IF EXISTS report_templates
    ADD COLUMN selected_user_id text;
ALTER TABLE IF EXISTS report_templates
    ADD COLUMN sort_by text;
ALTER TABLE IF EXISTS report_templates
    ADD COLUMN sort_order text;


ALTER TABLE IF EXISTS report_settings
    ADD COLUMN report_title text;
ALTER TABLE IF EXISTS report_settings
    ADD COLUMN show_logo boolean;
ALTER TABLE IF EXISTS report_settings
    ADD COLUMN show_header boolean;
ALTER TABLE IF EXISTS report_settings
    ADD COLUMN show_footer boolean;


ALTER TABLE IF EXISTS public.order_items
    RENAME product_cooler TO product_color;

ALTER TABLE IF EXISTS public.order_items
    ADD COLUMN shipment_id text;

ALTER TABLE IF EXISTS public.order_items
    ADD COLUMN product_name text;

ALTER TABLE IF EXISTS public.order_items
    ADD COLUMN sku text;

ALTER TABLE IF EXISTS public.order_items
    ADD COLUMN internal_note text;

ALTER TABLE IF EXISTS public.order_items
    ADD COLUMN customer_note text;

ALTER TABLE IF EXISTS public.order_items
    ADD COLUMN unit__weight numeric;

ALTER TABLE IF EXISTS public.order_items
    ADD COLUMN unit_cbm numeric;

ALTER TABLE IF EXISTS public.order_items
    ADD COLUMN total_packaging_price numeric;




ALTER TABLE IF EXISTS public.orders
    ADD COLUMN currency integer;

ALTER TABLE IF EXISTS public.orders
    ADD COLUMN order_currency integer;

ALTER TABLE IF EXISTS public.orders
    ADD COLUMN order_currency_price integer;

ALTER TABLE IF EXISTS public.orders
    ADD COLUMN external_order_number text;


ALTER TABLE IF EXISTS public.products DROP COLUMN IF EXISTS is_allowed;






ALTER TABLE IF EXISTS public.shipping_companies
    ADD COLUMN code text;
ALTER TABLE IF EXISTS public.shipping_companies
    ADD COLUMN country_id text;
ALTER TABLE IF EXISTS public.shipping_companies
    ADD COLUMN phone text;
ALTER TABLE IF EXISTS public.shipping_companies
    ADD COLUMN email text;
ALTER TABLE IF EXISTS public.shipping_companies
    ADD COLUMN api_url text;
ALTER TABLE IF EXISTS public.shipping_companies
    ADD COLUMN tracking_url_template text;
ALTER TABLE IF EXISTS public.shipping_companies
    ADD COLUMN api_enabled boolean;
ALTER TABLE IF EXISTS public.shipping_companies
    ADD COLUMN api_credentials_reference text;
ALTER TABLE IF EXISTS public.shipping_companies
    ADD COLUMN supports_tracking boolean;
ALTER TABLE IF EXISTS public.shipping_companies
    ADD COLUMN supports_webhook boolean;